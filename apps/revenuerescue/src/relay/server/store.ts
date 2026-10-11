import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RelayState } from "../contracts";
import { createRelayState } from "../seed";

export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
interface Receipt {
  id: string;
  fingerprint: string;
}
interface TenantRecord {
  PK: string;
  state: RelayState;
  receipts: Receipt[];
  expiresAt: number;
}
export interface Session {
  tenantId: string;
  expiresAt: number;
  role: "manager";
}
export interface RelayStore {
  session(token: string): Promise<Session | undefined>;
  createSession(): Promise<{ token: string; session: Session }>;
  read(tenantId: string): Promise<RelayState>;
  mutate(
    tenantId: string,
    expectedRevision: number | undefined,
    receipt: { id: string; fingerprint: string } | undefined,
    change: (state: RelayState) => RelayState,
  ): Promise<RelayState>;
  tenants(): Promise<string[]>;
  reserveAnalysis(tenantId: string): Promise<void>;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const nowSeconds = () => Math.floor(Date.now() / 1000);
function analysisBudget(tenantId: string) {
  if (
    tenantId === process.env.RELAY_PUBLIC_TEST_TENANT &&
    process.env.VOICE_ANALYSIS_LIMIT === "unlimited"
  )
    return { tenant: null, day: null, lifetime: null };
  const requested = Number(process.env.VOICE_ANALYSIS_LIMIT || "20");
  const tenant =
    tenantId === process.env.RELAY_PUBLIC_TEST_TENANT &&
    Number.isInteger(requested) &&
    requested >= 20 &&
    requested <= 500
      ? requested
      : 20;
  return { tenant, day: Math.max(100, tenant), lifetime: 500 };
}
function check(record: TenantRecord | undefined): TenantRecord {
  if (!record || record.expiresAt <= nowSeconds())
    throw new ServiceError(
      "This demo workspace has expired. Start a new guest session.",
      401,
      "SESSION_EXPIRED",
    );
  return record;
}
function apply(
  record: TenantRecord,
  expected: number | undefined,
  receipt: Receipt | undefined,
  change: (state: RelayState) => RelayState,
): TenantRecord {
  const previous = receipt && record.receipts.find((r) => r.id === receipt.id);
  if (previous) {
    if (previous.fingerprint !== receipt!.fingerprint)
      throw new ServiceError(
        "This request ID has already been used.",
        409,
        "CONFLICT",
      );
    return record;
  }
  if (expected !== undefined && record.state.revision !== expected)
    throw new ServiceError(
      "The schedule changed. Review the latest information and try again.",
      409,
      "CONFLICT",
    );
  const next = change(record.state);
  if (next === record.state && !receipt) return record;
  return {
    ...record,
    state: {
      ...next,
      tenantId: record.state.tenantId,
      revision: record.state.revision + 1,
    },
    receipts: receipt
      ? [...record.receipts, receipt].slice(-100)
      : record.receipts,
  };
}
export class SqliteRelayStore implements RelayStore {
  private db: DatabaseSync;
  constructor(
    path = process.env.RELAY_DB_PATH ?? resolve(".data/relay.sqlite"),
  ) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS relay_migrations (version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO relay_migrations VALUES (1); CREATE TABLE IF NOT EXISTS relay_records (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS relay_usage (key TEXT PRIMARY KEY, amount INTEGER NOT NULL);",
    );
  }
  private get<T>(key: string): T | undefined {
    const row = this.db
      .prepare("SELECT value FROM relay_records WHERE key=?")
      .get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }
  private put(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO relay_records VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  async session(token: string) {
    const s = this.get<Session>(`session:${hash(token)}`);
    return s && s.expiresAt > nowSeconds() ? s : undefined;
  }
  async createSession() {
    const token = randomBytes(32).toString("hex");
    const tenantId = randomUUID();
    const session: Session = {
      tenantId,
      role: "manager",
      expiresAt: nowSeconds() + 7200,
    };
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.increment(`sessions:${new Date().toISOString().slice(0, 10)}`, 100);
      this.put(`session:${hash(token)}`, session);
      this.put(`tenant:${tenantId}`, {
        PK: `RELAY#TENANT#${tenantId}`,
        state: createRelayState(tenantId, new Date().toISOString()),
        receipts: [],
        expiresAt: nowSeconds() + 86400,
      } satisfies TenantRecord);
      this.db.exec("COMMIT");
      return { token, session };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  async read(tenantId: string) {
    return check(this.get<TenantRecord>(`tenant:${tenantId}`)).state;
  }
  async mutate(
    tenantId: string,
    expected: number | undefined,
    receipt: Receipt | undefined,
    change: (s: RelayState) => RelayState,
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = check(this.get<TenantRecord>(`tenant:${tenantId}`));
      const next = apply(old, expected, receipt, change);
      if (next !== old) this.put(`tenant:${tenantId}`, next);
      this.db.exec("COMMIT");
      return next.state;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  async tenants() {
    return (
      this.db
        .prepare("SELECT value FROM relay_records WHERE key LIKE 'tenant:%'")
        .all() as { value: string }[]
    )
      .map((r) => JSON.parse(r.value) as TenantRecord)
      .filter((r) => r.expiresAt > nowSeconds())
      .slice(0, 100)
      .map((r) => r.state.tenantId);
  }
  private increment(key: string, limit: number | null) {
    const row = this.db
      .prepare("SELECT amount FROM relay_usage WHERE key=?")
      .get(key) as { amount: number } | undefined;
    if (limit !== null && (row?.amount ?? 0) >= limit)
      throw new ServiceError(
        "The demo analysis limit has been reached. No paid call was started.",
        429,
        "LIMITED",
      );
    this.db
      .prepare(
        "INSERT INTO relay_usage VALUES (?,1) ON CONFLICT(key) DO UPDATE SET amount=amount+1",
      )
      .run(key);
  }
  async reserveAnalysis(tenantId: string) {
    const budget = analysisBudget(tenantId);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.increment(
        `ai:day:${new Date().toISOString().slice(0, 10)}`,
        budget.day,
      );
      this.increment("ai:lifetime", budget.lifetime);
      this.increment(`ai:tenant:${tenantId}`, budget.tenant);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
export class DynamoRelayStore implements RelayStore {
  private db = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region:
        process.env.RELAY_DATA_REGION ?? process.env.AWS_REGION ?? "us-east-2",
      maxAttempts: 1,
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  constructor(private table = process.env.RELAY_TABLE_NAME!) {
    if (!table) throw new Error("Missing Relay table configuration.");
  }
  private async get<T>(PK: string) {
    return (
      await this.db.send(
        new GetCommand({
          TableName: this.table,
          Key: { PK },
          ConsistentRead: true,
        }),
      )
    ).Item as T | undefined;
  }
  async session(token: string) {
    const s = await this.get<Session>(`RELAY#SESSION#${hash(token)}`);
    return s && s.expiresAt > nowSeconds() ? s : undefined;
  }
  async createSession() {
    const token = randomBytes(32).toString("hex"),
      tenantId = randomUUID();
    const session: Session = {
      tenantId,
      role: "manager",
      expiresAt: nowSeconds() + 7200,
    };
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.table,
              Key: {
                PK: `RELAY#SESSIONS#${new Date().toISOString().slice(0, 10)}`,
              },
              UpdateExpression: "ADD #n :one",
              ConditionExpression: "attribute_not_exists(#n) OR #n < :limit",
              ExpressionAttributeNames: { "#n": "amount" },
              ExpressionAttributeValues: { ":one": 1, ":limit": 100 },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: { PK: `RELAY#SESSION#${hash(token)}`, ...session },
            },
          },
          {
            Put: {
              TableName: this.table,
              Item: {
                PK: `RELAY#TENANT#${tenantId}`,
                state: createRelayState(tenantId, new Date().toISOString()),
                receipts: [],
                expiresAt: nowSeconds() + 86400,
              },
            },
          },
        ],
      }),
    );
    return { token, session };
  }
  async read(tenantId: string) {
    return check(await this.get<TenantRecord>(`RELAY#TENANT#${tenantId}`))
      .state;
  }
  async mutate(
    tenantId: string,
    expected: number | undefined,
    receipt: Receipt | undefined,
    change: (s: RelayState) => RelayState,
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const old = check(
        await this.get<TenantRecord>(`RELAY#TENANT#${tenantId}`),
      );
      const next = apply(old, expected, receipt, change);
      if (next === old) return old.state;
      if (Buffer.byteLength(JSON.stringify(next)) > 330000)
        throw new ServiceError(
          "This demo workspace is full. Start a new guest session.",
          413,
          "WORKSPACE_FULL",
        );
      try {
        await this.db.send(
          new PutCommand({
            TableName: this.table,
            Item: next,
            ConditionExpression: "#s.#r = :revision",
            ExpressionAttributeNames: { "#s": "state", "#r": "revision" },
            ExpressionAttributeValues: { ":revision": old.state.revision },
          }),
        );
        return next.state;
      } catch (error) {
        if ((error as Error).name !== "ConditionalCheckFailedException")
          throw error;
        if (expected !== undefined || attempt === 2)
          throw new ServiceError(
            "The schedule changed. Refresh and try again.",
            409,
            "CONFLICT",
          );
      }
    }
    throw new ServiceError("The workspace is busy.", 409, "CONFLICT");
  }
  async tenants() {
    const tenants: string[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
      const page = await this.db.send(
        new ScanCommand({
          TableName: this.table,
          FilterExpression: "begins_with(PK, :prefix) AND expiresAt > :now",
          ExpressionAttributeValues: {
            ":prefix": "RELAY#TENANT#",
            ":now": nowSeconds(),
          },
          ProjectionExpression: "PK",
          Limit: 500,
          ExclusiveStartKey: cursor,
        }),
      );
      tenants.push(
        ...(page.Items ?? []).map((item) =>
          (item.PK as string).slice("RELAY#TENANT#".length),
        ),
      );
      cursor = page.LastEvaluatedKey;
    } while (cursor && tenants.length < 100);
    return tenants.slice(0, 100);
  }
  async reserveAnalysis(tenantId: string) {
    const budget = analysisBudget(tenantId);
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            ["day:" + new Date().toISOString().slice(0, 10), budget.day],
            ["lifetime", budget.lifetime],
            ["tenant:" + tenantId, budget.tenant],
          ].map(([key, limit]) => ({
            Update: {
              TableName: this.table,
              Key: { PK: `RELAY#AI#${key}` },
              UpdateExpression: "ADD #n :one",
              ExpressionAttributeNames: { "#n": "amount" },
              ...(limit === null
                ? { ExpressionAttributeValues: { ":one": 1 } }
                : {
                    ConditionExpression:
                      "attribute_not_exists(#n) OR #n < :limit",
                    ExpressionAttributeValues: { ":one": 1, ":limit": limit },
                  }),
            },
          })),
        }),
      );
    } catch (error) {
      if ((error as Error).name === "TransactionCanceledException")
        throw new ServiceError(
          "The demo analysis limit has been reached. No model call was started.",
          429,
          "LIMITED",
        );
      throw error;
    }
  }
}
let singleton: RelayStore | undefined;
export function getStore(): RelayStore {
  return (singleton ??= process.env.RELAY_TABLE_NAME
    ? new DynamoRelayStore()
    : new SqliteRelayStore());
}
