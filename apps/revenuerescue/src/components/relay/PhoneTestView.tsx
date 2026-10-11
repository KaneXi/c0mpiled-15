import { useState } from "react";
import type { RelayState } from "@/relay/contracts";
import s from "./Relay.module.css";
const stages = {
  waiting: "Ready to start",
  ready: "Ready",
  calling: "Calling",
  completed: "Finished",
  failed: "Needs attention",
  stopped: "Stopped",
};
export function PhoneTestView({
  state,
  connection,
}: {
  state: RelayState;
  connection: string;
}) {
  const test = state.phoneTest!;
  const outbound = test.mode === "outbound";
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const shift =
    state.shifts.find((row) => row.status === "published") ?? state.shifts[0];
  const assignments = state.assignments.filter(
    (row) => row.shiftId === shift.id && row.status !== "cancelled",
  );
  const names = assignments
    .map((row) => state.volunteers.find((v) => v.id === row.volunteerId)?.name)
    .filter(Boolean)
    .join(", ");
  const format = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  async function control(action: "start" | "stop") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/relay/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneTestAction: action, code }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || "Could not change calling state.");
      setMessage(
        action === "start"
          ? "Sequence started. AWS will place the first call within one minute."
          : "Sequence paused. No further calls will start.",
      );
      setCode("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.phoneTest}>
      <div className={s.brand}>
        Relay<span>.</span>
      </div>
      <header className={s.header}>
        <div>
          <h1>
            {outbound
              ? "One gap. The right replacement."
              : `${state.volunteers[0].name}’s phone test`}
          </h1>
          <p>
            {outbound
              ? "Check availability. Contact eligible replacements. Confirm coverage."
              : "Actual test schedule and live progress."}
          </p>
        </div>
        <span className={`${s.badge} ${s.warning}`}>{stages[test.stage]}</span>
      </header>
      {connection && <p role="alert">{connection}</p>}
      {outbound && (
        <section
          className={s.phoneTestSection}
          aria-labelledby="outbound-controls"
        >
          <h2 id="outbound-controls">Run the phone sequence</h2>
          <p>
            Up to two calls to the consented test numbers. Calls stop when
            someone accepts the full shift. Unclear answers are never treated as
            acceptance.
          </p>
          {test.callerNumber ? (
            <p>
              Caller number: <strong>{test.callerNumber}</strong>
            </p>
          ) : (
            <p>Phone service is not activated yet.</p>
          )}
          <label>
            Presenter code{" "}
            <input
              type="password"
              value={code}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
              maxLength={64}
            />
          </label>
          <div className={s.actions}>
            <button
              className={s.primary}
              disabled={busy || !code || !!test.startedAt || !test.callerNumber}
              onClick={() => void control("start")}
            >
              Start availability check
            </button>
            <button
              className={s.secondary}
              disabled={busy || !code || !test.startedAt || state.paused}
              onClick={() => void control("stop")}
            >
              Stop calling
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </section>
      )}
      <section className={s.phoneTestSection} aria-labelledby="test-schedule">
        <h2 id="test-schedule">Current assignment</h2>
        <dl className={s.phoneTestFacts}>
          <div>
            <dt>Assigned to</dt>
            <dd>{names || "Uncovered"}</dd>
          </div>
          <div>
            <dt>Attendance</dt>
            <dd>
              {assignments.some((a) => a.status === "confirmed")
                ? "Confirmed"
                : "Not confirmed"}
            </dd>
          </div>
          <div>
            <dt>Starts</dt>
            <dd>{format(shift.start)}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{format(shift.end)}</dd>
          </div>
        </dl>
      </section>
      {outbound && (
        <section className={s.phoneTestSection} aria-labelledby="call-sequence">
          <h2 id="call-sequence">Calls and candidate selection</h2>
          <ol className={s.phoneTestEvents}>
            {state.calls.map((call) => (
              <li key={call.id}>
                <strong>
                  {
                    state.volunteers.find((v) => v.id === call.volunteerId)
                      ?.name
                  }{" "}
                  ·{" "}
                  {call.purpose === "check_in"
                    ? "Original assignee"
                    : "Replacement"}
                </strong>
                <p>
                  {call.status.replaceAll("_", " ")}
                  {call.result
                    ? ` — ${call.result.outcome.replaceAll("_", " ")}`
                    : ""}
                </p>
                {call.result && <p>{call.result.summary}</p>}
              </li>
            ))}
          </ol>
          {state.incidents.map((incident) => (
            <div key={incident.id}>
              <p>
                {incident.status === "covered"
                  ? "Coverage restored. No further candidates will be called."
                  : incident.reason}
              </p>
              <p>
                Eligible candidates:{" "}
                {incident.candidates
                  .map(
                    (c) =>
                      state.volunteers.find((v) => v.id === c.volunteerId)
                        ?.name,
                  )
                  .join(", ") || "None"}
                .
              </p>
            </div>
          ))}
          <p className={s.hint}>
            Availability, required role, overlapping shifts and calling consent
            determine eligibility.
          </p>
        </section>
      )}
      <section className={s.phoneTestSection} aria-labelledby="test-progress">
        <h2 id="test-progress">What happened</h2>
        <p role="status">{test.detail}</p>
        <ol className={s.phoneTestEvents}>
          {test.events.map((event, i) => (
            <li key={`${event.at}-${i}`}>
              <time dateTime={event.at}>{format(event.at)}</time>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
        <p className={s.hint}>
          Updates automatically. Last recorded update: {format(test.updatedAt)}.
        </p>
      </section>
      <p>
        <a className={s.textButton} href="/">
          Back to the workspace
        </a>
      </p>
      <p className={s.hint}>
        {outbound
          ? "Audio is transcribed for the scheduling assistant; recordings are not saved. Only the presenter can start this bounded phone test."
          : "The completed test verified telephone connection and a spoken reminder. It did not verify two-way AI conversation."}
      </p>
    </main>
  );
}
