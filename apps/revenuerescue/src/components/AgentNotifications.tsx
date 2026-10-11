"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, LoaderCircle, Sparkles } from "lucide-react";
import type {
  DemoAction,
  DemoMode,
  DemoState,
  VolunteerAction,
  VolunteerState,
} from "@/domain/demo-types";
import {
  canonicalSerialize,
  projectAgentSnapshot,
  type AgentJob,
  type AnalyzeRequest,
} from "@/domain/agent-types";
import styles from "./AgentNotifications.module.css";

export type AgentSnapshot =
  | { mode: "business"; state: DemoState; revision: number; generation: number }
  | {
      mode: "volunteers";
      state: VolunteerState;
      revision: number;
      generation: number;
    };
export interface AgentIntakeEvent {
  id: string;
  mode: DemoMode;
  recordId: string;
  revision: number;
  generation: number;
  snapshot: AgentSnapshot;
}
export interface AgentConfirmationRequest {
  proposalId: string;
  eventId: string;
  mode: DemoMode;
  revision: number;
  generation: number;
  snapshotDigest: string;
  change:
    | {
        mode: "business";
        action: Extract<DemoAction, { type: "BOOK" | "RESCHEDULE" }>;
      }
    | {
        mode: "volunteers";
        action: Extract<VolunteerAction, { type: "ASSIGN" | "MOVE" }>;
      };
}
interface Props {
  liveAgentEnabled: boolean;
  snapshot: AgentSnapshot;
  pendingIntakes: readonly AgentIntakeEvent[];
  onIntakeConsumed(id: string): void;
  onConfirmProposal(request: AgentConfirmationRequest): void;
  confirmation: {
    proposalId: string;
    status: "applied" | "rejected";
    message: string;
  } | null;
}
interface Notice {
  event: AgentIntakeEvent;
  request: AnalyzeRequest;
  job?: AgentJob;
  error?: string;
  errorCode?: string;
  pending: boolean;
  checking?: boolean;
}

class RequestError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const value = await response.json().catch(() => null);
    if (!response.ok)
      throw new RequestError(
        value?.error?.message ??
          "The online assistant is temporarily unavailable. Please try again later.",
        value?.error?.code ??
          (response.status === 429 ? "BUSY" : "UNAVAILABLE"),
      );
    if (!value)
      throw new Error("The online assistant returned an unreadable result.");
    return value as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "The analysis took too long. Check its result before starting another request.",
        { cause: error },
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalSerialize(value)),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function matches(job: AgentJob, request: AnalyzeRequest): boolean {
  const b = job?.binding;
  return (
    !!b &&
    b.mode === request.mode &&
    b.generation === request.generation &&
    b.revision === request.revision &&
    b.intakeId === request.intakeId &&
    b.recordId === request.recordId &&
    typeof b.snapshotDigest === "string" &&
    ["PENDING", "READY", "FAILED", "LIMITED"].includes(job.status)
  );
}

export function AgentNotifications({
  liveAgentEnabled,
  snapshot,
  pendingIntakes,
  onIntakeConsumed,
  onConfirmProposal,
  confirmation,
}: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirming = useRef(false);
  const started = useRef(new Set<string>());
  const running = useRef(false);
  const sessionExpiry = useRef(0);
  const latestSnapshot = useRef(snapshot);
  latestSnapshot.current = snapshot;

  useEffect(() => {
    if (!liveAgentEnabled || running.current) return;
    const event = pendingIntakes.find((item) => !started.current.has(item.id));
    if (!event) return;
    started.current.add(event.id);
    running.current = true;
    setBusy(true);
    let request: AnalyzeRequest;
    try {
      request = {
        mode: event.mode,
        generation: event.generation,
        intakeId: event.id,
        revision: event.revision,
        recordId: event.recordId,
        snapshot: projectAgentSnapshot(
          event.mode,
          event.snapshot.state,
          event.recordId,
        ),
      };
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "The request is no longer available.",
      );
      running.current = false;
      setBusy(false);
      onIntakeConsumed(event.id);
      return;
    }
    setNotices((items) =>
      [{ event, request, pending: true }, ...items].slice(0, 20),
    );
    void (async () => {
      try {
        if (sessionExpiry.current <= Date.now() / 1000 + 30) {
          const session = await post<{ expiresAt: number }>("/api/session", {});
          sessionExpiry.current = session.expiresAt;
        }
        const job = await post<AgentJob>("/api/analyze", request);
        if (
          !matches(job, request) ||
          job.binding.snapshotDigest !== (await digest(request.snapshot))
        )
          throw new Error("This result did not match the submitted request.");
        setNotices((items) =>
          items.map((item) =>
            item.event.id === event.id
              ? { ...item, job, pending: false }
              : item,
          ),
        );
      } catch (error) {
        setNotices((items) =>
          items.map((item) =>
            item.event.id === event.id
              ? {
                  ...item,
                  pending: false,
                  errorCode:
                    error instanceof RequestError ? error.code : "UNAVAILABLE",
                  error:
                    error instanceof Error
                      ? error.message
                      : "The analysis could not finish.",
                }
              : item,
          ),
        );
      } finally {
        running.current = false;
        setBusy(false);
        onIntakeConsumed(event.id);
      }
    })();
  }, [liveAgentEnabled, pendingIntakes, onIntakeConsumed, busy]);

  async function checkResult(notice: Notice, retry = false) {
    setNotices((items) =>
      items.map((item) =>
        item.event.id === notice.event.id ? { ...item, checking: true } : item,
      ),
    );
    try {
      const { snapshot: _snapshot, ...identity } = notice.request;
      void _snapshot;
      if (retry && sessionExpiry.current <= Date.now() / 1000 + 30) {
        const session = await post<{ expiresAt: number }>("/api/session", {});
        sessionExpiry.current = session.expiresAt;
      }
      const job = await post<AgentJob>(
        retry ? "/api/analyze" : "/api/status",
        retry ? notice.request : identity,
      );
      if (
        !matches(job, notice.request) ||
        job.binding.snapshotDigest !== (await digest(notice.request.snapshot))
      )
        throw new Error("This result did not match the submitted request.");
      setNotices((items) =>
        items.map((item) =>
          item.event.id === notice.event.id
            ? {
                ...item,
                job,
                error: undefined,
                errorCode: undefined,
                checking: false,
              }
            : item,
        ),
      );
    } catch (error) {
      setNotices((items) =>
        items.map((item) =>
          item.event.id === notice.event.id
            ? {
                ...item,
                error:
                  error instanceof Error
                    ? error.message
                    : "No result is available yet.",
                errorCode:
                  error instanceof RequestError ? error.code : "UNAVAILABLE",
                checking: false,
              }
            : item,
        ),
      );
    }
  }

  async function confirm(notice: Notice) {
    const job = notice.job;
    const option = job?.result?.option;
    if (!job || job.status !== "READY" || !option || confirming.current) return;
    confirming.current = true;
    setConfirmingId(notice.event.id);
    try {
      const current = latestSnapshot.current;
      if (
        current.mode !== job.binding.mode ||
        current.generation !== job.binding.generation ||
        current.revision !== job.binding.revision
      )
        throw new Error(
          "The workspace has changed. Review the current schedule before confirming a time.",
        );
      const currentDigest = await digest(
        projectAgentSnapshot(current.mode, current.state, job.binding.recordId),
      );
      if (currentDigest !== job.binding.snapshotDigest)
        throw new Error(
          "The request or schedule has changed. This suggestion is no longer current.",
        );
      const base = {
        proposalId: job.jobId,
        eventId: notice.event.id,
        mode: current.mode,
        revision: current.revision,
        generation: current.generation,
        snapshotDigest: currentDigest,
      };
      if (
        current.mode === "business" &&
        (option.action.type === "BOOK" || option.action.type === "RESCHEDULE")
      ) {
        onConfirmProposal({
          ...base,
          change: { mode: "business", action: option.action },
        });
      } else if (
        current.mode === "volunteers" &&
        (option.action.type === "ASSIGN" || option.action.type === "MOVE")
      ) {
        onConfirmProposal({
          ...base,
          change: { mode: "volunteers", action: option.action },
        });
      } else
        throw new Error("This suggestion belongs to a different workspace.");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Please review the current schedule.",
      );
    } finally {
      confirming.current = false;
      setConfirmingId(null);
    }
  }

  const visible = notices.filter(
    (notice) =>
      notice.event.mode === snapshot.mode &&
      notice.event.generation === snapshot.generation,
  );
  return (
    <section
      className={styles.panel}
      aria-labelledby="agent-notifications-title"
    >
      <div className={styles.heading}>
        <span className={styles.icon}>
          <Bell size={19} />
        </span>
        <div>
          <h2 id="agent-notifications-title">Your assistant’s updates</h2>
          <p>
            {liveAgentEnabled
              ? "New requests are checked automatically. You decide what happens next."
              : "Offline copy. Live AWS analysis is available on the online website."}
          </p>
        </div>
        <span className={styles.badge}>
          {liveAgentEnabled ? "AWS assistant" : "Offline"}
        </span>
      </div>
      <div aria-live="polite" aria-atomic="false">
        {feedback && <p className={styles.feedback}>{feedback}</p>}
        {confirmation && (
          <p className={styles.feedback}>{confirmation.message}</p>
        )}
        {!visible.length && (
          <p className={styles.empty}>
            {liveAgentEnabled
              ? "Add a sample request or choose “Simulate incoming request” to see a real analysis arrive here."
              : "Sample scheduling and guided tours still work. This file cannot contact the assistant."}
          </p>
        )}
        {visible.map((notice) => {
          const { job } = notice;
          const stale = notice.event.revision !== snapshot.revision;
          const applied =
            confirmation?.proposalId === job?.jobId &&
            confirmation?.status === "applied";
          return (
            <article key={notice.event.id} className={styles.notice}>
              <div className={styles.noticeTitle}>
                {notice.pending ? (
                  <LoaderCircle size={17} className={styles.spin} />
                ) : applied ? (
                  <Check size={17} />
                ) : (
                  <Sparkles size={17} />
                )}
                <strong>
                  {notice.pending
                    ? "Checking this request…"
                    : applied
                      ? "Sample schedule updated"
                      : ["LIMITED", "SESSION_LIMIT"].includes(
                            notice.errorCode ?? "",
                          ) || job?.status === "LIMITED"
                        ? "Demo limit reached"
                        : notice.errorCode === "BUSY"
                          ? "The assistant is busy"
                          : notice.error || job?.status === "FAILED"
                            ? "Analysis could not finish"
                            : job?.status === "PENDING"
                              ? "Analysis is still pending"
                              : stale
                                ? "Earlier suggestion"
                                : "A new update for you"}
                </strong>
              </div>
              {notice.pending && (
                <p>
                  Reading the request and checking the sample schedule with AWS.
                </p>
              )}
              {(notice.error || job?.error) && (
                <p>{notice.error ?? job?.error?.message}</p>
              )}
              {job?.result && (
                <>
                  <p>{job.result.summary}</p>
                  {job.result.questions.length > 0 && (
                    <ul>
                      {job.result.questions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  )}
                  {job.result.option && (
                    <div className={styles.option}>
                      <span>{job.result.option.label}</span>
                      <button
                        type="button"
                        disabled={stale || applied || confirmingId !== null}
                        onClick={() => void confirm(notice)}
                      >
                        {confirmingId === notice.event.id
                          ? "Checking schedule…"
                          : applied
                          ? "Confirmed"
                          : stale
                            ? "Schedule changed"
                            : "Confirm sample time"}
                      </button>
                    </div>
                  )}
                </>
              )}
              {job?.provenance && (
                <div className={styles.provenance}>
                  Analyzed by Amazon Bedrock ·{" "}
                  {job.provenance.toolNames.length
                    ? "Sample availability checked"
                    : "Request reviewed"}
                  <details>
                    <summary>How this was checked</summary>
                    <p>
                      Model: {job.provenance.modelId}
                      <br />
                      Tools: {job.provenance.toolNames.join(", ") || "None"}
                      <br />
                      Model calls: {job.provenance.modelCalls}
                    </p>
                  </details>
                </div>
              )}
              {((notice.error &&
                !["LIMITED", "SESSION_LIMIT"].includes(
                  notice.errorCode ?? "",
                )) ||
                job?.status === "PENDING") && (
                <button
                  className={styles.check}
                  type="button"
                  disabled={notice.checking}
                  onClick={() =>
                    void checkResult(notice, notice.errorCode === "BUSY")
                  }
                >
                  {notice.checking
                    ? "Checking…"
                    : notice.errorCode === "BUSY"
                      ? "Try this request again"
                      : "Check result"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
