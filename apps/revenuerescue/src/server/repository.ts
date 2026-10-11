import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  canonicalSerialize,
  type AgentIdentity,
  type AgentJob,
} from "../domain/agent-types";
import { AgentError } from "./errors";

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const jobKey = (session: string, identity: AgentIdentity) =>
  `JOB#${session}#${sha256(canonicalSerialize(identity))}`;
export interface SessionRecord {
  expiresAt: number;
  jobsUsed: number;
}
export interface StoredJob {
  requestHash: string;
  createdAt: number;
  expiresAt: number;
  job: AgentJob;
}
export interface AgentRepository {
  session(
    sessionHash: string,
    signal?: AbortSignal,
  ): Promise<SessionRecord | undefined>;
  createSession(
    sessionHash: string,
    now: number,
    signal?: AbortSignal,
  ): Promise<SessionRecord>;
  job(
    sessionHash: string,
    identity: AgentIdentity,
    signal?: AbortSignal,
  ): Promise<StoredJob | undefined>;
  reserve(
    sessionHash: string,
    identity: AgentIdentity,
    requestHash: string,
    job: AgentJob,
    now: number,
    signal?: AbortSignal,
  ): Promise<{ record: StoredJob; fresh: boolean }>;
  finish(
    sessionHash: string,
    identity: AgentIdentity,
    requestHash: string,
    job: AgentJob,
    signal?: AbortSignal,
  ): Promise<void>;
}

type Sender = Pick<DynamoDBDocumentClient, "send">;
export class DynamoAgentRepository implements AgentRepository {
  constructor(
    private tableName: string,
    private db: Sender = DynamoDBDocumentClient.from(
      new DynamoDBClient({ maxAttempts: 1 }),
      { marshallOptions: { removeUndefinedValues: true } },
    ),
  ) {}

  async session(
    sessionHash: string,
    signal?: AbortSignal,
  ): Promise<SessionRecord | undefined> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `SESSION#${sessionHash}` },
        ConsistentRead: true,
      }),
      { abortSignal: signal },
    );
    return result.Item as SessionRecord | undefined;
  }

  async createSession(
    sessionHash: string,
    now: number,
    signal?: AbortSignal,
  ): Promise<SessionRecord> {
    const expiresAt = Math.floor(now / 1000) + 7200;
    const day = new Date(now).toISOString().slice(0, 10);
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { PK: `SESSION#${sessionHash}`, expiresAt, jobsUsed: 0 },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `SESSION_CREATION#${day}` },
                UpdateExpression:
                  "SET #count = if_not_exists(#count, :zero) + :one, expiresAt = :expiry",
                ConditionExpression:
                  "attribute_not_exists(#count) OR #count < :limit",
                ExpressionAttributeNames: { "#count": "count" },
                ExpressionAttributeValues: {
                  ":zero": 0,
                  ":one": 1,
                  ":limit": 200,
                  ":expiry": Math.floor(now / 1000) + 172800,
                },
              },
            },
          ],
        }),
        { abortSignal: signal },
      );
    } catch (error) {
      if ((error as Error).name === "TransactionCanceledException")
        throw new AgentError(
          "SESSION_LIMIT",
          "The daily guest limit has been reached. Please try again tomorrow.",
          429,
        );
      throw error;
    }
    return { expiresAt, jobsUsed: 0 };
  }

  async job(
    sessionHash: string,
    identity: AgentIdentity,
    signal?: AbortSignal,
  ): Promise<StoredJob | undefined> {
    const result = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: jobKey(sessionHash, identity) },
        ConsistentRead: true,
      }),
      { abortSignal: signal },
    );
    return result.Item as StoredJob | undefined;
  }

  async reserve(
    sessionHash: string,
    identity: AgentIdentity,
    requestHash: string,
    job: AgentJob,
    now: number,
    signal?: AbortSignal,
  ) {
    const existing = await this.job(sessionHash, identity, signal);
    if (existing) return this.duplicate(existing, requestHash);
    const seconds = Math.floor(now / 1000);
    const record: StoredJob = {
      requestHash,
      createdAt: now,
      expiresAt: seconds + 86400,
      job,
    };
    const counter = (PK: string, limit: number, expire: boolean) => ({
      Update: {
        TableName: this.tableName,
        Key: { PK },
        UpdateExpression: `SET #count = if_not_exists(#count, :zero) + :one${expire ? ", expiresAt = :expiry" : ""}`,
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#count": "count" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":limit": limit,
          ...(expire ? { ":expiry": seconds + 172800 } : {}),
        },
      },
    });
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { PK: jobKey(sessionHash, identity), ...record },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            counter(
              `QUOTA#DAY#${new Date(now).toISOString().slice(0, 10)}`,
              100,
              true,
            ),
            counter("QUOTA#LIFETIME", 500, false),
            {
              Update: {
                TableName: this.tableName,
                Key: { PK: `SESSION#${sessionHash}` },
                UpdateExpression: "SET jobsUsed = jobsUsed + :one",
                ConditionExpression:
                  "attribute_exists(PK) AND expiresAt > :now AND jobsUsed < :limit",
                ExpressionAttributeValues: {
                  ":one": 1,
                  ":now": seconds,
                  ":limit": 10,
                },
              },
            },
          ],
        }),
        { abortSignal: signal },
      );
      return { record, fresh: true };
    } catch (error) {
      const failure = error as {
        name?: string;
        CancellationReasons?: { Code?: string }[];
      };
      if (
        failure.name !== "TransactionCanceledException" &&
        failure.name !== "TransactionConflictException"
      )
        throw error;
      const duplicate = await this.job(sessionHash, identity, signal);
      if (duplicate) return this.duplicate(duplicate, requestHash);
      if (
        failure.name === "TransactionConflictException" ||
        failure.CancellationReasons?.some(
          (reason) => reason.Code === "TransactionConflict",
        )
      )
        throw new AgentError(
          "BUSY",
          "The assistant is busy. Try this same request again shortly.",
          429,
        );
      throw new AgentError(
        "LIMITED",
        "This guest session or the public demo has reached its analysis limit.",
        429,
      );
    }
  }

  private duplicate(record: StoredJob, requestHash: string) {
    if (record.requestHash !== requestHash)
      throw new AgentError(
        "REQUEST_CONFLICT",
        "This incoming request was already analyzed with different details.",
        409,
      );
    return { record, fresh: false };
  }

  async finish(
    sessionHash: string,
    identity: AgentIdentity,
    requestHash: string,
    job: AgentJob,
    signal?: AbortSignal,
  ) {
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: jobKey(sessionHash, identity) },
        UpdateExpression: "SET job = :job",
        ConditionExpression: "requestHash = :hash AND job.#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":job": job,
          ":hash": requestHash,
          ":pending": "PENDING",
        },
      }),
      { abortSignal: signal },
    );
  }
}
