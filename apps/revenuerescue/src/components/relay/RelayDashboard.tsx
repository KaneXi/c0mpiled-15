"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Users,
  Phone,
  Pause,
  Play,
  Plus,
  HelpCircle,
  ArrowRight,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import type {
  Call,
  CallOutcome,
  Incident,
  RelayView,
  Shift,
  Volunteer,
} from "@/relay/contracts";
import { RelayApiError, relayApi } from "./api";
import { ShiftEditor, VolunteerEditor, type SendCommand } from "./Editors";
import { browserZone, dateTime, label } from "./format";
import s from "./Relay.module.css";

type Tab = "schedule" | "volunteers" | "calls";
type Editor =
  { type: "shift"; value?: Shift } | { type: "volunteer"; value?: Volunteer };

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning";
}) {
  return <span className={`${s.badge} ${s[tone]}`}>{children}</span>;
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="relay-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={s.sectionHeading}>
        <h2 id="relay-dialog-title">{title}</h2>
        <button
          autoFocus
          className={s.iconButton}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Approval({
  incident,
  view,
  send,
  busy,
  onMyself,
}: {
  incident: Incident;
  view: RelayView;
  send: SendCommand;
  busy: boolean;
  onMyself: () => void;
}) {
  const shift = view.state.shifts.find((v) => v.id === incident.shiftId);
  const names = incident.candidates.map((candidate) => ({
    ...candidate,
    name:
      view.state.volunteers.find((v) => v.id === candidate.volunteerId)?.name ??
      "Volunteer",
  }));
  return (
    <article className={s.approval}>
      <div className={s.sectionHeading}>
        <h3>{shift?.title ?? "Shift needs cover"}</h3>
        <Badge tone="warning">
          {incident.status === "pending"
            ? "Needs your decision"
            : "Outreach approved"}
        </Badge>
      </div>
      <p>{incident.reason}</p>
      {names.length > 0 ? (
        <ol className={s.candidates}>
          {names.map((candidate) => (
            <li key={candidate.volunteerId}>
              <strong>{candidate.name}</strong>
              <span>{candidate.reasons.join(" · ")}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={s.hint}>
          No eligible candidates were found. Review volunteer availability or
          assign yourself.
        </p>
      )}
      <p className={s.hint}>
        With Yes, Relay contacts candidates in this order, up to{" "}
        {incident.maxAttempts} attempts. It rechecks availability before each
        step.
      </p>
      {incident.status === "pending" ? (
        <div className={s.actions}>
          <button
            className={s.primary}
            disabled={busy || names.length === 0}
            onClick={() =>
              void send(
                {
                  type: "DECIDE_INCIDENT",
                  incidentId: incident.id,
                  decision: "yes",
                },
                "Outreach approved. Relay will contact the next eligible candidate automatically.",
              )
            }
          >
            <Check size={16} /> Yes
          </button>
          <button
            className={s.secondary}
            disabled={busy}
            onClick={() =>
              void send(
                {
                  type: "DECIDE_INCIDENT",
                  incidentId: incident.id,
                  decision: "no",
                },
                "Plan rejected. This outreach plan has stopped.",
              )
            }
          >
            No
          </button>
          <button className={s.textButton} disabled={busy} onClick={onMyself}>
            Assign myself <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className={s.actions}>
          <span className={s.hint}>
            {incident.attemptedIds.length} candidates attempted
          </span>
          <button
            className={s.secondary}
            disabled={busy}
            onClick={() =>
              void send(
                { type: "REVOKE_INCIDENT", incidentId: incident.id },
                "Approval revoked. No further calls will start for this plan.",
              )
            }
          >
            Stop this plan
          </button>
        </div>
      )}
    </article>
  );
}

function ShiftRow({
  shift,
  view,
  send,
  busy,
  edit,
}: {
  shift: Shift;
  view: RelayView;
  send: SendCommand;
  busy: boolean;
  edit: () => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const [volunteerId, setVolunteerId] = useState("");
  const [cancel, setCancel] = useState(false);
  const assignments = view.state.assignments.filter(
    (a) => a.shiftId === shift.id && a.status !== "cancelled",
  );
  const incident = view.state.incidents.find(
    (i) =>
      i.shiftId === shift.id &&
      ["pending", "approved", "exhausted"].includes(i.status),
  );
  return (
    <article className={s.shift}>
      <div className={s.shiftMain}>
        <div className={s.sectionHeading}>
          <h3>{shift.title}</h3>
          <Badge tone={incident ? "warning" : "neutral"}>
            {incident
              ? incident.status === "exhausted"
                ? "Needs manual cover"
                : "At risk"
              : label(shift.status)}
          </Badge>
        </div>
        <p className={s.shiftTime}>
          {dateTime(shift.start)} — {dateTime(shift.end)}
        </p>
        <p className={s.hint}>
          {shift.role} · {assignments.length} / {shift.required} assigned ·{" "}
          {assignments.filter((a) => a.status === "confirmed").length} confirmed
        </p>
        <ul className={s.assignmentList}>
          {assignments.map((a) => (
            <li key={a.id}>
              <span>
                {view.state.volunteers.find((v) => v.id === a.volunteerId)
                  ?.name ?? "Volunteer"}{" "}
                <span className={s.hint}>· {label(a.status)}</span>
                {a.note && <small>{a.note}</small>}
              </span>
              {shift.status !== "cancelled" && (
                <button
                  className={s.textButton}
                  disabled={busy}
                  onClick={() =>
                    void send(
                      { type: "CANCEL_ASSIGNMENT", assignmentId: a.id },
                      "Assignment removed. Published coverage will be checked automatically.",
                    )
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {shift.status !== "cancelled" && (
        <div className={s.shiftActions}>
          {shift.status === "draft" && (
            <>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() =>
                  void send(
                    { type: "PUBLISH_SHIFT", shiftId: shift.id },
                    "Schedule published. Relay now monitors this shift and schedules due check-ins.",
                  )
                }
              >
                Publish shift
              </button>
              <button className={s.secondary} disabled={busy} onClick={edit}>
                Edit draft
              </button>
            </>
          )}
          <button
            className={s.secondary}
            disabled={busy}
            aria-expanded={assigning}
            onClick={() => setAssigning(!assigning)}
          >
            Assign volunteer
          </button>
          <button
            className={s.textButton}
            disabled={busy}
            onClick={() => setCancel(!cancel)}
          >
            Cancel shift
          </button>
        </div>
      )}
      {assigning && shift.status !== "cancelled" && (
        <form
          className={s.inlineForm}
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await send(
                { type: "ASSIGN", shiftId: shift.id, volunteerId },
                "Volunteer assigned.",
              )
            ) {
              setAssigning(false);
              setVolunteerId("");
            }
          }}
        >
          <label>
            Choose volunteer
            <select
              required
              value={volunteerId}
              onChange={(event) => setVolunteerId(event.target.value)}
            >
              <option value="">Select a volunteer</option>
              {view.state.volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.roles.join(", ")}
                </option>
              ))}
            </select>
          </label>
          <button className={s.primary} disabled={busy} type="submit">
            Confirm assignment
          </button>
          <p className={s.hint}>
            Relay checks qualifications, availability and conflicts before
            saving.
          </p>
        </form>
      )}
      {cancel && shift.status !== "cancelled" && (
        <div className={s.inlineConfirm}>
          <p>Cancel this shift and stop its future outreach?</p>
          <div className={s.actions}>
            <button
              className={s.danger}
              disabled={busy}
              onClick={() =>
                void send(
                  { type: "CANCEL_SHIFT", shiftId: shift.id },
                  "Shift cancelled.",
                )
              }
            >
              Confirm cancellation
            </button>
            <button className={s.secondary} onClick={() => setCancel(false)}>
              Keep shift
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

const outcomes: CallOutcome[] = [
  "confirmed",
  "declined",
  "uncertain",
  "late",
  "partial",
  "question",
  "no_answer",
  "opt_out",
];

function CallRow({
  call,
  view,
  busy,
  send,
}: {
  call: Call;
  view: RelayView;
  busy: boolean;
  send: SendCommand;
}) {
  const [transcript, setTranscript] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  // Configured or temporarily unavailable Bedrock still accepts a real retry.
  const manual = view.providers.ai.label === "AWS AI is off";
  const volunteer = view.state.volunteers.find(
    (v) => v.id === call.volunteerId,
  );
  const shift = view.state.shifts.find((v) => v.id === call.shiftId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await send(
      {
        type: "SUBMIT_CALL",
        callId: call.id,
        transcript,
        ...(manual && outcome ? { simulatedOutcome: outcome } : {}),
      },
      manual
        ? "Manual simulator result recorded."
        : "Conversation submitted for server analysis.",
    );
  }
  return (
    <article className={s.call}>
      <div className={s.sectionHeading}>
        <div>
          <h3>{volunteer?.name ?? "Volunteer"}</h3>
          <p className={s.hint}>
            {call.purpose === "replacement"
              ? "Replacement invitation"
              : "Schedule check-in"}{" "}
            · {shift?.title}
          </p>
        </div>
        <Badge
          tone={
            call.status === "in_progress" || call.status === "analyzing"
              ? "warning"
              : "neutral"
          }
        >
          {label(call.status)}
        </Badge>
      </div>
      <p className={s.callMeta}>
        {call.transport === "simulated"
          ? "Simulated call · no phone call placed"
          : "Amazon Connect call"}{" "}
        · Attempt {call.attempt} ·{" "}
        {dateTime(call.completedAt ?? call.startedAt ?? call.dueAt)}
      </p>
      {call.status === "in_progress" && call.transport === "simulated" && (
        <form onSubmit={submit} className={s.transcriptForm}>
          <label>
            Volunteer’s conversation
            <textarea
              rows={4}
              required
              maxLength={8000}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Write the whole conversation, including corrections or uncertainty…"
            />
          </label>
          <p className={s.hint}>
            You are playing the volunteer’s side of a simulated call. Relay
            already started this check-in.
          </p>
          {manual ? (
            <div className={s.manual}>
              <p>
                <strong>AWS AI is off.</strong> Choose an explicit simulator
                result; this will not be labeled as AI.
              </p>
              <label>
                Manual simulator outcome
                <select
                  required
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(event.target.value as CallOutcome | "")
                  }
                >
                  <option value="">Choose a result</option>
                  {outcomes.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className={s.hint}>
              The server will interpret the whole conversation using{" "}
              {view.providers.ai.label}.
            </p>
          )}
          <button
            className={s.primary}
            type="submit"
            disabled={busy || !transcript.trim() || (manual && !outcome)}
          >
            {busy
              ? "Submitting…"
              : manual
                ? "Record simulator result"
                : "Submit conversation"}
          </button>
          <button
            className={s.secondary}
            type="button"
            disabled={busy}
            onClick={() =>
              void send(
                {
                  type: "SUBMIT_CALL",
                  callId: call.id,
                  transcript: "Simulator transport: no answer.",
                  simulatedOutcome: "no_answer",
                },
                "Simulated no-answer result recorded. Relay will determine the next step.",
              )
            }
          >
            Simulate no answer
          </button>
        </form>
      )}
      {call.status === "analyzing" && (
        <p className={s.waiting}>
          The server is interpreting the conversation. This page updates
          automatically.
        </p>
      )}
      {call.status === "queued" && (
        <p className={s.hint}>
          {view.state.paused
            ? "Paused. No new calls will start until you resume."
            : `Scheduled for ${dateTime(call.dueAt)}. Relay checks permission and calling hours before starting.`}
        </p>
      )}
      {call.result && (
        <div className={s.callResult}>
          <Badge
            tone={call.result.outcome === "confirmed" ? "good" : "warning"}
          >
            {label(call.result.outcome)}
          </Badge>
          <p>{call.result.summary}</p>
          {call.result.clarification && (
            <p>
              <strong>Clarification:</strong> {call.result.clarification}
            </p>
          )}
          <p className={s.hint}>
            {call.interpretationProvider === "amazon-bedrock"
              ? "Interpreted by Amazon Bedrock"
              : "Explicit manual simulator result"}
          </p>
        </div>
      )}
      {call.error && <p className={s.error}>{call.error}</p>}
      {call.transcript && (
        <details className={s.details}>
          <summary>Read conversation</summary>
          <p className={s.transcript}>{call.transcript}</p>
        </details>
      )}
    </article>
  );
}

export default function RelayDashboard() {
  const [view, setView] = useState<RelayView | null>(null);
  const viewRef = useRef<RelayView | null>(null);
  const [tab, setTab] = useState<Tab>("schedule");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const commandPending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("");
  const [help, setHelp] = useState(false);
  const [myself, setMyself] = useState<Incident | null>(null);
  const [reset, setReset] = useState(false);
  const [reload, setReload] = useState(0);
  const update = useCallback((next: RelayView) => {
    if (!next?.state) return;
    const previous = viewRef.current;
    if (
      previous &&
      next.state.tenantId === previous.state.tenantId &&
      next.state.revision < previous.state.revision
    )
      return;
    viewRef.current = next;
    setView(next);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await relayApi.read(controller.signal);
        if (active) {
          update(next);
          setConnection("");
        }
      } catch (cause) {
        if (active)
          setConnection(
            cause instanceof RelayApiError && cause.status === 401
              ? "Your guest session expired. Reload to start a new sample workspace."
              : "Connection interrupted. Your saved data is still on the server. Reconnecting…",
          );
      }
      if (active) timer = setTimeout(poll, 3000);
    }
    async function load() {
      setError("");
      try {
        try {
          const current = await relayApi.read(controller.signal);
          if (active) update(current);
        } catch (cause) {
          if (!(cause instanceof RelayApiError) || cause.status !== 401)
            throw cause;
          if (!active) return;
          await relayApi.session(controller.signal);
          const current = await relayApi.read(controller.signal);
          if (active) update(current);
        }
        if (active) {
          setConnection("");
          timer = setTimeout(poll, 3000);
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not open this workspace.",
          );
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [update, reload]);

  const send: SendCommand = async (command, success) => {
    if (!viewRef.current || commandPending.current) return false;
    commandPending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await relayApi.command(
        command,
        viewRef.current.state.revision,
      );
      update(next);
      setNotice(success);
      return true;
    } catch (cause) {
      setError(
        cause instanceof RelayApiError && cause.status === 409
          ? "The schedule changed while you were working. The latest version is shown; review it and try again."
          : cause instanceof Error
            ? cause.message
            : "The change was not confirmed. Please check the latest state.",
      );
      try {
        update(await relayApi.read());
      } catch {
        setConnection(
          "Could not refresh the latest state. Check your connection before trying again.",
        );
      }
      return false;
    } finally {
      commandPending.current = false;
      setBusy(false);
    }
  };

  if (!view)
    return (
      <main className={s.loading}>
        <div className={s.brand}>
          Relay<span>.</span>
        </div>
        <h1>
          {error ? "Your workspace could not open" : "Opening your workspace"}
        </h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className={s.primary} onClick={() => setReload(reload + 1)}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">
            Loading your saved schedule, volunteers and call history…
          </p>
        )}
      </main>
    );

  const state = view.state;
  const openIncidents = state.incidents.filter(
    (i) => i.status === "pending" || i.status === "approved",
  );
  const currentCalls = state.calls
    .filter((c) => ["in_progress", "analyzing", "queued"].includes(c.status))
    .sort(
      (a, b) =>
        (a.status === "queued" ? 1 : 0) - (b.status === "queued" ? 1 : 0),
    );
  const history = state.calls
    .filter((c) => !["in_progress", "analyzing", "queued"].includes(c.status))
    .slice()
    .reverse();
  const manager = state.volunteers.find(
    (v) => v.id === state.managerVolunteerId,
  );
  const changeTab = (next: Tab) => {
    setTab(next);
    setEditor(null);
  };

  return (
    <div className={s.app}>
      <a href="#relay-main" className={s.skip}>
        Skip to workspace
      </a>
      <aside className={s.sidebar}>
        <a href="/" className={s.brand} aria-label="Relay dashboard">
          Relay<span>.</span>
        </a>
        <div className={s.organization}>
          <strong>{state.organization}</strong>
          <span>Guest manager · fictional data</span>
        </div>
        <nav aria-label="Workspace" className={s.navigation}>
          {(
            [
              ["schedule", CalendarDays, "Schedule"],
              ["volunteers", Users, "Volunteers"],
              ["calls", Phone, "Calls"],
            ] as const
          ).map(([value, Icon, text]) => (
            <button
              key={value}
              aria-current={tab === value ? "page" : undefined}
              onClick={() => changeTab(value)}
            >
              <Icon size={19} />
              <span>{text}</span>
              {value === "calls" && currentCalls.length > 0 && (
                <span className={s.navCount}>{currentCalls.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className={s.sidebarBottom}>
          <button className={s.textButton} onClick={() => setHelp(true)}>
            <HelpCircle size={18} /> Help
          </button>
          <button
            className={s.textButton}
            disabled={busy}
            onClick={() => setReset(true)}
          >
            <RefreshCw size={16} /> Reset sample workspace
          </button>
          <p>Calls are simulated. No volunteers are phoned.</p>
        </div>
      </aside>
      <main id="relay-main" className={s.main}>
        <header className={s.header}>
          <div>
            <h1>
              {tab === "schedule"
                ? "Your team, ready for the next shift."
                : tab === "volunteers"
                  ? "People you can count on."
                  : "Every conversation, accounted for."}
            </h1>
            <p>
              {tab === "schedule"
                ? "Plan the schedule. Relay follows up and brings gaps to you."
                : tab === "volunteers"
                  ? "Keep availability and calling permissions up to date."
                  : "Automatic check-ins and approved replacement outreach."}
            </p>
          </div>
          <button
            className={state.paused ? s.primary : s.pause}
            disabled={busy}
            onClick={() =>
              void send(
                { type: "SET_PAUSED", paused: !state.paused },
                state.paused
                  ? "AI calls resumed. Relay will recheck each queued call before starting."
                  : "AI calls paused. No new calls will start; active calls can finish.",
              )
            }
          >
            {state.paused ? <Play size={17} /> : <Pause size={17} />}
            {state.paused ? "Resume AI Calls" : "Pause AI Calls"}
          </button>
        </header>
        <div className={s.statusBar}>
          <Badge tone={state.paused ? "warning" : "good"}>
            {state.paused ? "Paused" : "Monitoring published shifts"}
          </Badge>
          <span>
            {state.shifts.filter((v) => v.status === "published").length}{" "}
            published shifts
          </span>
          <span>{openIncidents.length} open plans</span>
          <span>{currentCalls.length} active / queued calls</span>
        </div>
        {connection && (
          <div className={s.error} role="status">
            {connection}
            <button
              className={s.textButton}
              onClick={() => setReload(reload + 1)}
            >
              Reconnect
            </button>
          </div>
        )}
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
        <div className={s.notice} role="status" aria-live="polite">
          {notice}
        </div>
        {state.paused && (
          <p className={s.pausedNotice}>
            New calls are paused. Monitoring and schedule edits can continue.
          </p>
        )}
        {tab === "schedule" && (
          <>
            {openIncidents.length > 0 && (
              <section className={s.attention}>
                <div className={s.sectionHeading}>
                  <h2>Needs your attention</h2>
                  <span className={s.hint}>You decide who gets contacted.</span>
                </div>
                {openIncidents.map((incident) => (
                  <Approval
                    key={incident.id}
                    incident={incident}
                    view={view}
                    send={send}
                    busy={busy}
                    onMyself={() => setMyself(incident)}
                  />
                ))}
              </section>
            )}
            <section className={s.section}>
              <div className={s.sectionHeading}>
                <div>
                  <h2>Schedule & coverage</h2>
                  <p className={s.hint}>All times shown in {browserZone()}.</p>
                </div>
                <button
                  className={s.primary}
                  disabled={busy}
                  onClick={() => setEditor({ type: "shift" })}
                >
                  <Plus size={17} /> Create shift
                </button>
              </div>
              {editor?.type === "shift" && (
                <ShiftEditor
                  key={editor.value?.id ?? "new"}
                  shift={editor.value}
                  now={view.now}
                  send={send}
                  busy={busy}
                  onClose={() => setEditor(null)}
                />
              )}
              {state.shifts.length === 0 ? (
                <div className={s.empty}>
                  <h3>Start with a shift.</h3>
                  <p>
                    Create a draft, assign volunteers, and publish when the
                    schedule is ready.
                  </p>
                </div>
              ) : (
                <div className={s.shiftList}>
                  {state.shifts.map((shift) => (
                    <ShiftRow
                      key={shift.id}
                      shift={shift}
                      view={view}
                      send={send}
                      busy={busy}
                      edit={() => setEditor({ type: "shift", value: shift })}
                    />
                  ))}
                </div>
              )}
            </section>
            <ActivityList view={view} />
          </>
        )}
        {tab === "volunteers" && (
          <section className={s.section}>
            <div className={s.sectionHeading}>
              <h2>
                Volunteers{" "}
                <span className={s.count}>{state.volunteers.length}</span>
              </h2>
              <button
                className={s.primary}
                disabled={busy}
                onClick={() => setEditor({ type: "volunteer" })}
              >
                <Plus size={17} /> Add volunteer
              </button>
            </div>
            {editor?.type === "volunteer" && (
              <VolunteerEditor
                key={editor.value?.id ?? "new"}
                volunteer={editor.value}
                send={send}
                busy={busy}
                onClose={() => setEditor(null)}
              />
            )}
            <div className={s.volunteerList}>
              {state.volunteers.map((volunteer) => (
                <article key={volunteer.id} className={s.volunteer}>
                  <div className={s.avatar} aria-hidden="true">
                    {volunteer.name
                      .split(" ")
                      .map((v) => v[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className={s.volunteerInfo}>
                    <h3>
                      {volunteer.name}
                      {volunteer.id === state.managerVolunteerId && (
                        <span className={s.hint}> · You</span>
                      )}
                    </h3>
                    <p>
                      {volunteer.phone} · {volunteer.roles.join(", ")}
                    </p>
                    <div className={s.volunteerFlags}>
                      <Badge
                        tone={
                          volunteer.callingConsent &&
                          !volunteer.optedOut &&
                          volunteer.active
                            ? "good"
                            : "warning"
                        }
                      >
                        {volunteer.optedOut
                          ? "Opted out"
                          : !volunteer.active
                            ? "Inactive"
                            : volunteer.callingConsent
                              ? "Calling permitted"
                              : "No calling permission"}
                      </Badge>
                      <span className={s.hint}>
                        Recording{" "}
                        {volunteer.recordingConsent
                          ? "permitted"
                          : "not permitted"}
                      </span>
                    </div>
                    <details className={s.details}>
                      <summary>Availability & calling hours</summary>
                      {volunteer.availability.length ? (
                        <ul>
                          {volunteer.availability.map((w, index) => (
                            <li key={index}>
                              {dateTime(w.start)} — {dateTime(w.end)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          No availability recorded. Add availability before
                          assigning a shift.
                        </p>
                      )}
                      <p>
                        Quiet hours: {volunteer.quietHours.start}:00–
                        {volunteer.quietHours.end}:00 · {volunteer.timezone}
                      </p>
                    </details>
                  </div>
                  <button
                    className={s.secondary}
                    disabled={busy}
                    onClick={() => {
                      setEditor({ type: "volunteer", value: volunteer });
                      document
                        .getElementById("relay-main")
                        ?.scrollIntoView({ behavior: "instant" });
                    }}
                  >
                    Edit
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
        {tab === "calls" && (
          <>
            <section className={s.section}>
              <div className={s.sectionHeading}>
                <h2>Active & queued calls</h2>
                <Badge>Simulated transport</Badge>
              </div>
              <p className={s.sectionIntro}>
                Relay starts due calls automatically after a shift is published.
                Fill in the volunteer’s side when a simulated call is in
                progress.
              </p>
              {currentCalls.length ? (
                currentCalls.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    view={view}
                    send={send}
                    busy={busy}
                  />
                ))
              ) : (
                <div className={s.empty}>
                  <h3>No calls waiting.</h3>
                  <p>
                    Publish an assigned shift to let Relay plan its check-ins.
                    Permission, calling hours and timing are checked on the
                    server.
                  </p>
                </div>
              )}
            </section>
            <section className={s.section}>
              <h2>Call history</h2>
              {history.length ? (
                history.map((call) => (
                  <CallRow
                    key={call.id}
                    call={call}
                    view={view}
                    send={send}
                    busy={busy}
                  />
                ))
              ) : (
                <p className={s.empty}>
                  Completed, failed and cancelled calls will appear here.
                </p>
              )}
            </section>
            <ActivityList view={view} />
          </>
        )}
        <footer className={s.footer}>
          <details>
            <summary>
              Service status · {view.providers.ai.label} ·{" "}
              {view.providers.calling.label}
            </summary>
            <dl>
              {Object.entries(view.providers).map(([name, provider]) => (
                <div key={name}>
                  <dt>
                    {label(name)} · {label(provider.status)}
                  </dt>
                  <dd>
                    {provider.label}. {provider.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          <span>Saved on the server · updates every 3 seconds</span>
        </footer>
      </main>
      {myself && (
        <Dialog
          title="Assign yourself to this shift?"
          onClose={() => setMyself(null)}
        >
          <p>
            <strong>{manager?.name ?? "You"}</strong> will replace the missing
            volunteer on{" "}
            <strong>
              {state.shifts.find((v) => v.id === myself.shiftId)?.title}
            </strong>
            . Relay will check your qualifications, availability and conflicts
            before saving, then stop this replacement plan.
          </p>
          <div className={s.dialogActions}>
            <button className={s.secondary} onClick={() => setMyself(null)}>
              Go back
            </button>
            <button
              className={s.primary}
              disabled={busy}
              onClick={async () => {
                if (
                  await send(
                    {
                      type: "DECIDE_INCIDENT",
                      incidentId: myself.id,
                      decision: "myself",
                    },
                    "You are assigned. Replacement outreach has stopped.",
                  )
                )
                  setMyself(null);
              }}
            >
              Confirm my assignment
            </button>
          </div>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {reset && (
        <Dialog
          title="Reset this sample workspace?"
          onClose={() => setReset(false)}
        >
          <p>
            This replaces your sample volunteers, schedule and call history with
            the starting examples. Other workspaces are unaffected.
          </p>
          <div className={s.dialogActions}>
            <button className={s.secondary} onClick={() => setReset(false)}>
              Keep my changes
            </button>
            <button
              className={s.danger}
              disabled={busy}
              onClick={async () => {
                if (
                  await send({ type: "RESET_DEMO" }, "Sample workspace reset.")
                ) {
                  setReset(false);
                  setEditor(null);
                  setTab("schedule");
                }
              }}
            >
              Reset sample workspace
            </button>
          </div>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {help && (
        <Dialog title="A quick guide to Relay" onClose={() => setHelp(false)}>
          <ol className={s.help}>
            <li>
              <strong>Make the schedule.</strong> Create a draft shift, assign
              qualified volunteers and publish it. Only you publish the initial
              schedule.
            </li>
            <li>
              <strong>Let Relay check in.</strong> The server plans due calls.
              In Calls, write the volunteer’s whole reply when a simulated call
              starts.
            </li>
            <li>
              <strong>Review a gap.</strong> Relay shows eligible candidates.
              Yes approves the listed outreach; No stops the plan. Assign myself
              asks you to confirm first.
            </li>
            <li>
              <strong>Follow the result.</strong> Each call records its outcome
              and next action. The server rechecks coverage before saving a
              replacement.
            </li>
            <li>
              <strong>Pause whenever needed.</strong> Pause AI Calls stops new
              calls. Active calls can finish safely.
            </li>
          </ol>
          <p className={s.hint}>
            Fictional workspace. No real calls or payments. Provider status
            below the workspace tells you whether interpretation uses Bedrock or
            an explicit manual simulator.
          </p>
          <button className={s.primary} onClick={() => setHelp(false)}>
            Got it
          </button>
        </Dialog>
      )}
    </div>
  );
}

function ActivityList({ view }: { view: RelayView }) {
  return (
    <section className={s.section}>
      <h2>Recent activity</h2>
      {view.state.activity.length ? (
        <ol className={s.activity}>
          {view.state.activity
            .slice(-10)
            .reverse()
            .map((item) => (
              <li key={item.id}>
                <div>
                  <p>{item.text}</p>
                  {item.nextAction && (
                    <span className={s.hint}>Next: {item.nextAction}</span>
                  )}
                  {item.transport && (
                    <span className={s.hint}>
                      {" "}
                      ·{" "}
                      {item.transport === "simulated"
                        ? "Simulated call"
                        : "Amazon Connect"}
                    </span>
                  )}
                </div>
                <time dateTime={item.at}>{dateTime(item.at)}</time>
              </li>
            ))}
        </ol>
      ) : (
        <p className={s.empty}>
          Schedule changes and every call outcome will be recorded here.
        </p>
      )}
    </section>
  );
}
