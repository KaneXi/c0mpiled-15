import type { RelayState } from "@/relay/contracts";
import s from "./Relay.module.css";

const stages = {
  waiting: "Waiting to call",
  ready: "Phone line ready",
  calling: "Calling",
  completed: "Call ended",
  failed: "Test blocked",
  stopped: "Test stopped",
};

export function PhoneTestView({
  state,
  connection,
}: {
  state: RelayState;
  connection: string;
}) {
  const test = state.phoneTest!;
  const person = state.volunteers[0];
  const shift = state.shifts[0];
  const format = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: person.timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  return (
    <main className={s.phoneTest}>
      <div className={s.brand}>
        Relay<span>.</span>
      </div>
      <header className={s.header}>
        <div>
          <h1>{person.name}’s phone test</h1>
          <p>Actual test schedule and live progress.</p>
        </div>
        <span className={`${s.badge} ${s.warning}`}>{stages[test.stage]}</span>
      </header>
      {connection && <p role="alert">{connection}</p>}
      <section className={s.phoneTestSection} aria-labelledby="test-schedule">
        <h2 id="test-schedule">Your test shift</h2>
        <dl className={s.phoneTestFacts}>
          <div>
            <dt>Volunteer</dt>
            <dd>{person.name}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>US number ending in {person.phone.slice(-4)}</dd>
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
        <p>
          One authorized call, up to two minutes. No recording. Attendance
          remains unconfirmed.
        </p>
      </section>
      <section className={s.phoneTestSection} aria-labelledby="test-progress">
        <h2 id="test-progress">Test progress</h2>
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
        This first test verifies a real telephone connection and a spoken
        reminder. Free-form AI voice conversation is not connected yet. This
        page cannot start a call.
      </p>
    </main>
  );
}
