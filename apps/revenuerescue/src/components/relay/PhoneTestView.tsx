import { useState } from "react";
import { DateTime } from "luxon";
import type { RelayState } from "@/relay/contracts";
import s from "./Relay.module.css";
import { availabilityQuestion } from "@/relay/voice/prompts";
const stages = {
  waiting: "Waiting for inquiry time",
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
  const localValue = (value: DateTime) =>
    value.setZone("America/New_York").toFormat("yyyy-MM-dd'T'HH:mm");
  const participants = state.volunteers.filter(
    (person) =>
      person.id !== state.managerVolunteerId &&
      person.callingConsent &&
      !person.optedOut,
  );
  const previousOriginal = state.calls.find(
    (call) => call.purpose === "check_in",
  )?.volunteerId;
  const first =
    test.originalVolunteerId ||
    participants.find((person) => person.id !== previousOriginal)?.id ||
    participants[0]?.id ||
    "";
  const [originalId, setOriginalId] = useState(first);
  const [replacementId, setReplacementId] = useState(
    test.replacementVolunteerId ||
      participants.find((person) => person.id !== first)?.id ||
      "",
  );
  const [shiftStart, setShiftStart] = useState(() =>
    localValue(
      test.runId
        ? DateTime.fromISO(state.shifts[0].start)
        : DateTime.now().plus({ minutes: 20 }),
    ),
  );
  const [shiftEnd, setShiftEnd] = useState(() =>
    localValue(
      test.runId
        ? DateTime.fromISO(state.shifts[0].end)
        : DateTime.now().plus({ minutes: 80 }),
    ),
  );
  const [inquiryTime, setInquiryTime] = useState(() =>
    localValue(
      test.scheduledFor
        ? DateTime.fromISO(test.scheduledFor)
        : DateTime.now().plus({ minutes: 2 }),
    ),
  );
  const [authorizeCalls, setAuthorizeCalls] = useState(false);
  const shift =
    state.shifts.find((row) => row.status === "published") ?? state.shifts[0];
  const planChanged =
    !!test.runId &&
    (originalId !== test.originalVolunteerId ||
      replacementId !== test.replacementVolunteerId ||
      shiftStart !== localValue(DateTime.fromISO(shift.start)) ||
      shiftEnd !== localValue(DateTime.fromISO(shift.end)));
  const savedOriginal = participants.find(
    (person) => person.id === test.originalVolunteerId,
  );
  const savedReplacement = participants.find(
    (person) => person.id === test.replacementVolunteerId,
  );
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
  async function control(action: "prepare" | "schedule" | "stop") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/relay/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneTestAction: action,
          code,
          ...(action === "prepare"
            ? {
                setup: {
                  originalId,
                  replacementId,
                  start: DateTime.fromISO(shiftStart, {
                    zone: "America/New_York",
                  })
                    .toUTC()
                    .toISO(),
                  end: DateTime.fromISO(shiftEnd, { zone: "America/New_York" })
                    .toUTC()
                    .toISO(),
                },
              }
            : {}),
          ...(action === "schedule"
            ? {
                authorizeCalls,
                scheduledFor: DateTime.fromISO(inquiryTime, {
                  zone: "America/New_York",
                })
                  .toUTC()
                  .toISO(),
              }
            : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || "Could not change calling state.");
      setMessage(
        action === "prepare"
          ? "Roster and shift saved. Set the inquiry time and confirm authorization below."
          : action === "schedule"
            ? "Inquiry scheduled. AWS starts at or shortly after that time, even if you close this page."
            : "Sequence paused. No further calls will start.",
      );
      if (action === "prepare")
        setInquiryTime(localValue(DateTime.now().plus({ minutes: 2 })));
      if (action !== "prepare") {
        setAuthorizeCalls(false);
      }
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
          <h2 id="outbound-controls">Set up the next test</h2>
          <p>
            Choose who receives the first inquiry and who can replace them.
            Names and masked numbers come from the authorized two-person roster.
          </p>
          <label>
            Presenter code{" "}
            <input
              type="password"
              value={code}
              autoComplete="off"
              onChange={(event) => setCode(event.target.value)}
              maxLength={64}
            />
          </label>
          <div className={s.formGrid}>
            <label>
              Ask first
              <select
                value={originalId}
                disabled={busy || !state.paused}
                onChange={(event) => {
                  setOriginalId(event.target.value);
                  if (event.target.value === replacementId)
                    setReplacementId(originalId);
                }}
              >
                {participants.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ask as replacement
              <select
                value={replacementId}
                disabled={busy || !state.paused}
                onChange={(event) => {
                  setReplacementId(event.target.value);
                  if (event.target.value === originalId)
                    setOriginalId(replacementId);
                }}
              >
                {participants.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Shift starts · Eastern time
              <input
                type="datetime-local"
                value={shiftStart}
                disabled={busy || !state.paused}
                onChange={(event) => setShiftStart(event.target.value)}
              />
            </label>
            <label>
              Shift ends · Eastern time
              <input
                type="datetime-local"
                value={shiftEnd}
                disabled={busy || !state.paused}
                onChange={(event) => setShiftEnd(event.target.value)}
              />
            </label>
          </div>
          <p className={s.hint}>
            Saving sets this test roster's availability to the selected shift.
            Actual attendance still requires a spoken answer. Past call results
            remain below.
          </p>
          <button
            className={s.secondary}
            disabled={
              busy ||
              !code ||
              !state.paused ||
              !!test.callerNumber ||
              originalId === replacementId
            }
            onClick={() => void control("prepare")}
          >
            Save roster &amp; shift
          </button>
          {test.runId && savedOriginal && savedReplacement && (
            <div className={s.savedPhonePlan}>
              <h3>Saved calling plan</h3>
              <p>
                <strong>{savedOriginal.name}</strong> first →{" "}
                <strong>{savedReplacement.name}</strong> only if the first
                person cannot attend.
              </p>
              <p>{availabilityQuestion(shift, savedOriginal)}</p>
              <p className={s.hint}>
                {Math.max(0, 3 - (test.runsScheduled || 0))} test runs remain in
                this demo allowance.
              </p>
            </div>
          )}
          {planChanged && (
            <p role="status">
              Save your updated roster and shift before scheduling.
            </p>
          )}
          <h3>Schedule the first inquiry</h3>
          <label>
            Inquiry time · America/New_York
            <input
              type="datetime-local"
              value={inquiryTime}
              disabled={busy || !!test.armedAt || !!test.startedAt}
              onChange={(event) => setInquiryTime(event.target.value)}
            />
          </label>
          <button
            className={s.textButton}
            disabled={busy || !!test.armedAt || !!test.startedAt}
            onClick={() =>
              setInquiryTime(localValue(DateTime.now().plus({ minutes: 2 })))
            }
          >
            Use two minutes from now
          </button>
          {test.scheduledFor && (
            <p role="status">
              Inquiry scheduled for <strong>{format(test.scheduledFor)}</strong>
              . The server checks once per minute; it may start up to a minute
              later. You can close this page.
            </p>
          )}
          {test.callerNumber && (
            <p>
              Caller number: <strong>{test.callerNumber}</strong>
            </p>
          )}
          <label>
            <span>
              <input
                type="checkbox"
                checked={authorizeCalls}
                disabled={busy || !!test.armedAt || !!test.startedAt}
                onChange={(event) => setAuthorizeCalls(event.target.checked)}
              />{" "}
              I authorize up to two real calls to these consenting participants,
              with a $2 test budget. AWS charges apply; this is not a hard
              billing cap.
            </span>
          </label>
          <p className={s.hint}>
            At the inquiry time, the first person is asked about the exact shift
            hours. Only an explicit refusal triggers the replacement call.
            Unclear answers do not confirm coverage. The temporary caller number
            is released automatically when the run ends.
          </p>
          <div className={s.actions}>
            <button
              className={s.primary}
              disabled={
                busy ||
                !code ||
                !inquiryTime ||
                !authorizeCalls ||
                !test.runId ||
                planChanged ||
                !!test.armedAt ||
                !!test.startedAt
              }
              onClick={() => void control("schedule")}
            >
              Schedule automatic inquiry
            </button>
            <button
              className={s.secondary}
              disabled={
                busy ||
                !code ||
                (!test.startedAt && !test.armedAt) ||
                state.paused
              }
              onClick={() => void control("stop")}
            >
              Cancel / stop calling
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
          {state.calls.length === 0 && (
            <p>
              No call has started. The next change will appear here
              automatically.
            </p>
          )}
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
      {!!test.history?.length && (
        <section className={s.phoneTestSection} aria-labelledby="past-tests">
          <h2 id="past-tests">Past tests</h2>
          {test.history.map((run, index) => (
            <details key={`${run.endedAt}-${index}`}>
              <summary>
                {format(run.endedAt)} ·{" "}
                {run.assignmentNames.length
                  ? `Confirmed: ${run.assignmentNames.join(", ")}`
                  : "No replacement confirmed"}
              </summary>
              <p>
                {run.shift.title}: {format(run.shift.start)} –{" "}
                {format(run.shift.end)}
              </p>
              <ul>
                {run.calls.map((call) => (
                  <li key={call.id}>
                    {
                      state.volunteers.find(
                        (person) => person.id === call.volunteerId,
                      )?.name
                    }
                    : {call.result?.outcome.replaceAll("_", " ") || call.status}
                  </li>
                ))}
              </ul>
            </details>
          ))}
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
