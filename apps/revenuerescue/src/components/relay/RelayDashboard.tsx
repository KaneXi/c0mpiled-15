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
  VolunteerInput,
} from "@/relay/contracts";
import { RelayApiError, relayApi } from "./api";
import { ShiftEditor, VolunteerEditor, type SendCommand } from "./Editors";
import { browserZone, dateTime, label } from "./format";
import { SubscriptionLink } from "./SubscriptionPlan";
import { PhoneTestView } from "./PhoneTestView";
import { managerMessages } from "./manager-messages";
import { RelayTour } from "./RelayTour";
import { RELAY_TOUR_KEY, type RelayTourTab } from "./tour-flow";
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
    <article className={s.shift} data-relay-tour="shift">
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
              {!view.state.phoneTest && shift.status !== "cancelled" && (
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
      {!view.state.phoneTest && shift.status !== "cancelled" && (
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
  const savedConfirmation =
    !view.state.phoneTest ||
    view.state.assignments.some(
      (assignment) =>
        assignment.shiftId === call.shiftId &&
        assignment.volunteerId === call.volunteerId &&
        assignment.status === "confirmed",
    );
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
    <article
      className={s.call}
      data-relay-tour={
        ["queued", "in_progress", "analyzing", "failed"].includes(call.status)
          ? "active-call"
          : undefined
      }
    >
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
      {["in_progress", "failed"].includes(call.status) &&
        call.transport === "simulated" && (
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
                  : call.status === "failed"
                    ? "Retry conversation"
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
            tone={
              call.result.outcome === "confirmed" && savedConfirmation
                ? "good"
                : "warning"
            }
          >
            {call.result.outcome === "confirmed" && !savedConfirmation
              ? "Needs review · no assignment saved"
              : label(call.result.outcome)}
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
  const [liveControls, setLiveControls] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const commandPending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connection, setConnection] = useState("");
  const [help, setHelp] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const tourReturnTab = useRef<Tab>("schedule");
  useEffect(() => {
    try {
      setWelcome(!localStorage.getItem(RELAY_TOUR_KEY));
    } catch {
      setWelcome(true);
    }
  }, []);
  const rememberTour = (completed: boolean) => {
    try {
      localStorage.setItem(
        RELAY_TOUR_KEY,
        completed ? "completed" : "dismissed",
      );
    } catch {
      /* A blocked preference store must not block the guide. */
    }
    setWelcome(false);
  };
  const startTour = () => {
    tourReturnTab.current = tab;
    setWelcome(false);
    setHelp(true);
  };
  const navigateTour = useCallback((next: RelayTourTab) => setTab(next), []);
  const finishTour = (completed: boolean) => {
    rememberTour(completed);
    setTab(tourReturnTab.current);
    setHelp(false);
  };
  const [myself, setMyself] = useState<Incident | null>(null);
  const [reset, setReset] = useState(false);
  const [sample, setSample] = useState<"starter" | "four-person">(
    "four-person",
  );
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
    if (
      !viewRef.current ||
      commandPending.current ||
      help ||
      viewRef.current.state.phoneTest
    )
      return false;
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

  const saveLiveVolunteer = async (volunteer: VolunteerInput, code: string) => {
    if (commandPending.current || help) return false;
    commandPending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/relay/command", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({
          phoneTestAction: "save_volunteer",
          code,
          volunteer,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.error || "Could not save the volunteer. Please try again.",
        );
      setNotice(
        `${volunteer.name} was added. Choose them in Create task to arrange a call.`,
      );
      try {
        update(await relayApi.read());
      } catch {
        setConnection("Volunteer saved. Reconnecting to refresh the roster…");
      }
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save the volunteer.",
      );
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
  const live = !!state.phoneTest;
  const messages = live ? managerMessages(state) : [];
  const openIncidents = state.incidents.filter(
    (i) => i.status === "pending" || i.status === "approved",
  );
  const currentCalls = state.calls
    .filter((c) =>
      ["in_progress", "analyzing", "queued", "failed"].includes(c.status),
    )
    .sort(
      (a, b) =>
        (a.status === "queued" ? 1 : 0) - (b.status === "queued" ? 1 : 0),
    );
  const history = state.calls
    .filter(
      (c) =>
        !["in_progress", "analyzing", "queued", "failed"].includes(c.status),
    )
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
          <span>
            {live
              ? "Live volunteer coordination"
              : "Guest manager · fictional data"}
          </span>
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
          <SubscriptionLink />
          <button
            className={s.textButton}
            data-relay-help
            disabled={busy || !!editor}
            title={
              editor
                ? "Save or cancel your edit before taking the tour."
                : "Take the quick tour"
            }
            onClick={startTour}
          >
            <HelpCircle size={18} /> Help
          </button>
          <button
            className={s.textButton}
            disabled={busy}
            onClick={() => setReset(true)}
            hidden={live}
          >
            <RefreshCw size={16} /> Sample schedules
          </button>
          <p>
            {live
              ? "Real calls start only after manager authorization."
              : "Calls are simulated. No volunteers are phoned."}
          </p>
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
            data-relay-tour="pause"
            disabled={busy || help}
            onClick={() =>
              live
                ? setLiveControls(true)
                : void send(
                    { type: "SET_PAUSED", paused: !state.paused },
                    state.paused
                      ? "AI calls resumed. Relay will recheck each queued call before starting."
                      : "AI calls paused. No new calls will start; active calls can finish.",
                  )
            }
          >
            {state.paused ? <Play size={17} /> : <Pause size={17} />}
            {live
              ? "Manage calls"
              : state.paused
                ? "Resume AI Calls"
                : "Pause AI Calls"}
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

        {welcome && (
          <section
            className={s.tourWelcome}
            aria-labelledby="relay-welcome-title"
          >
            <div>
              <h2 id="relay-welcome-title">
                A little guidance to get started.
              </h2>
              <p>
                See how a schedule becomes a check-in, and a gap becomes a
                replacement. About a minute, with no changes to your workspace.
              </p>
            </div>
            <div className={s.actions}>
              <button
                className={s.primary}
                disabled={busy || !!editor}
                onClick={startTour}
              >
                Take a quick tour <ArrowRight size={16} />
              </button>
              <button
                className={s.textButton}
                onClick={() => rememberTour(false)}
              >
                Skip for now
              </button>
            </div>
          </section>
        )}
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
            {state.shifts.some(
              (shift) => shift.id === "shift-sample-meals",
            ) && (
              <section
                className={s.section}
                aria-labelledby="sample-guide-title"
              >
                <div className={s.sectionHeading}>
                  <h2 id="sample-guide-title">Four-person test schedule</h2>
                  <span className={s.badge}>Fictional · simulated calls</span>
                </div>
                <p>
                  Publish <strong>Sample · Meal packing</strong>, then select{" "}
                  <strong>Resume AI Calls</strong>. Leave the other two shifts
                  as drafts.
                </p>
                <p>
                  Kane is the original assignee. Avery and Samira are eligible
                  replacements, in that order. Riley is busy at the overlapping
                  welcome desk. Casey is the manager and is excluded from
                  automatic outreach.
                </p>
                <details>
                  <summary>Test steps and expected results</summary>
                  <ol>
                    <li>
                      Open Calls and submit Kane’s refusal in your own words. A
                      replacement plan should appear in Schedule.
                    </li>
                    <li>
                      Select Yes on that plan. In Calls, let Avery decline, then
                      let Samira clearly accept the full shift. Exactly one
                      replacement should be assigned; Riley should not be
                      contacted for this shift.
                    </li>
                    <li>
                      Reload this sample for another run. Try a clear
                      confirmation (no replacement), an uncertain or partial
                      answer (no confirmed coverage), or have both replacements
                      refuse (shift remains uncovered).
                    </li>
                    <li>
                      For the qualification test, reload the sample and publish
                      only Sample · Supply lead. Resume calls and let Kane
                      decline. Nobody else has that role, so the shift must
                      remain uncovered.
                    </li>
                  </ol>
                  <p className={s.hint}>
                    Calling hours remain 8 AM–10 PM America/New_York. Use Sample
                    schedules to refresh expired dates. Demo permission flags do
                    not authorize real calls; all displayed phone numbers are
                    fictional.
                  </p>
                </details>
              </section>
            )}
            {!live && (openIncidents.length > 0 || help) && (
              <section className={s.attention} data-relay-tour="attention">
                <div className={s.sectionHeading}>
                  <h2>Needs your attention</h2>
                  <span className={s.hint}>You decide who gets contacted.</span>
                </div>
                {openIncidents.length === 0 && (
                  <p className={s.tourEmpty}>
                    No replacement plan needs a decision right now. A real plan
                    will appear here when Relay finds a gap.
                  </p>
                )}
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
            <section className={s.section} data-relay-tour="schedule">
              <div className={s.sectionHeading}>
                <div>
                  <h2>Schedule & coverage</h2>
                  <p className={s.hint}>All times shown in {browserZone()}.</p>
                </div>
                <button
                  className={s.primary}
                  disabled={busy || help}
                  onClick={() =>
                    live ? setLiveControls(true) : setEditor({ type: "shift" })
                  }
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
                      busy={busy || live}
                      edit={() => setEditor({ type: "shift", value: shift })}
                    />
                  ))}
                </div>
              )}
            </section>
            {live && (
              <section className={s.section} aria-labelledby="manager-inbox">
                <div className={s.sectionHeading}>
                  <h2 id="manager-inbox">Manager messages</h2>
                  <Badge tone="warning">
                    {
                      messages.filter((item) => item.kind !== "confirmed")
                        .length
                    }{" "}
                    need attention
                  </Badge>
                </div>
                <p className={s.hint}>
                  Declined and unsuccessful calls remain here. Updates are saved
                  automatically.
                </p>
                <div role="log" aria-live="polite" aria-relevant="additions">
                  {messages.length ? (
                    <ul className={s.managerMessages}>
                      {messages.map((item) => (
                        <li key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <Badge
                              tone={
                                item.kind === "confirmed" ? "good" : "warning"
                              }
                            >
                              {item.label}
                            </Badge>
                          </div>
                          <p>{item.message}</p>
                          <p>
                            {item.shiftTitle} · {dateTime(item.start)} —{" "}
                            {dateTime(item.end)}
                          </p>
                          <time dateTime={item.at}>
                            {dateTime(item.at)}
                            {item.previous ? " · Previous task" : ""}
                          </time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No manager messages yet.</p>
                  )}
                </div>
              </section>
            )}
            {live && (
              <PhoneTestView state={state} connection="" mode="progress" />
            )}
            <ActivityList view={view} />
          </>
        )}
        {tab === "volunteers" && (
          <section className={s.section} data-relay-tour="volunteers">
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
                onSaveLive={live ? saveLiveVolunteer : undefined}
              />
            )}
            <div className={s.volunteerList}>
              {state.volunteers.map((volunteer) => (
                <article
                  key={volunteer.id}
                  className={s.volunteer}
                  data-relay-tour="volunteer"
                >
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
                    disabled={busy || live}
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
            <section className={s.section} data-relay-tour="calls">
              <div className={s.sectionHeading}>
                <h2>Active & queued calls</h2>
                <Badge>{live ? "Amazon Connect" : "Simulated transport"}</Badge>
              </div>
              <p className={s.sectionIntro}>
                {live
                  ? "Authorized calls and spoken answers update here automatically. Use Manage calls to start or stop the saved sequence."
                  : "Relay starts due calls automatically after a shift is published. Fill in the volunteer’s side when a simulated call is in progress."}
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
      {liveControls && live && (
        <Dialog
          title="Create task & manage calls"
          onClose={() => setLiveControls(false)}
        >
          <PhoneTestView
            state={state}
            connection={connection}
            mode="controls"
          />
        </Dialog>
      )}
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
        <Dialog title="Load a sample schedule?" onClose={() => setReset(false)}>
          <p>
            This replaces your sample volunteers, schedule and call history with
            the selected fictional examples. Other workspaces are unaffected.
          </p>
          <label>
            Choose a sample
            <select
              value={sample}
              disabled={busy}
              onChange={(event) =>
                setSample(event.target.value as "starter" | "four-person")
              }
            >
              <option value="four-person">
                Four-person test · replacement and conflicts
              </option>
              <option value="starter">Original starter workspace</option>
            </select>
          </label>
          <p className={s.hint}>
            The four-person sample uses future draft shifts, fictional numbers
            and paused calls. Loading it does not publish shifts or place phone
            calls.
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
                  await send(
                    { type: "RESET_DEMO", sample },
                    "Sample schedule loaded. Review the drafts before publishing.",
                  )
                ) {
                  setReset(false);
                  setEditor(null);
                  setTab("schedule");
                }
              }}
            >
              Replace with sample
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
        <RelayTour
          onNavigate={navigateTour}
          onClose={finishTour}
          hasPlans={openIncidents.length > 0}
          hasCalls={currentCalls.length > 0}
          aiLabel={view.providers.ai.label}
        />
      )}
    </div>
  );
}

function ActivityList({ view }: { view: RelayView }) {
  return (
    <section className={s.section} data-relay-tour="activity">
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
