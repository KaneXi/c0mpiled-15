import { afterEach, describe, expect, it, vi } from "vitest";
import { createRelayState } from "../src/relay/seed";
import {
  preparePhoneTest,
  schedulePhoneTest,
  phoneTestRunLimit,
} from "../src/relay/voice/control";
const now = "2026-10-11T21:00:00.000Z";
function fixture() {
  const s = createRelayState("test", now);
  s.paused = true;
  s.phoneTest = {
    mode: "outbound",
    stage: "stopped",
    detail: "Old run",
    updatedAt: now,
    events: [],
  };
  vi.stubEnv(
    "VOICE_ALLOWED_PHONES",
    JSON.stringify(s.volunteers.map((v) => v.phone)),
  );
  const people = s.volunteers.filter((v) => v.id !== s.managerVolunteerId);
  const setup = {
    originalId: people[1].id,
    replacementId: people[0].id,
    start: "2026-10-11T21:20:00.000Z",
    end: "2026-10-11T22:20:00.000Z",
  };
  return { s, setup };
}
afterEach(() => vi.unstubAllEnvs());
describe("website-owned phone planning", () => {
  it("starts immediately with the saved hours and rejects duplicate or expired starts", () => {
    const { s, setup } = fixture();
    const ready = preparePhoneTest(s, setup, now);
    const started = schedulePhoneTest(ready, undefined, now, true);
    expect(started.phoneTest?.scheduledFor).toBe(now);
    expect(started.phoneTest?.runsScheduled).toBe(1);
    expect(started.shifts).toEqual(ready.shifts);
    expect(started.paused).toBe(false);
    expect(() => schedulePhoneTest(started, undefined, now, true)).toThrow(
      /already/,
    );
    expect(() =>
      schedulePhoneTest(ready, undefined, setup.start, true),
    ).toThrow(/check-in window/);
    ready.phoneTest!.closesAt = now;
    expect(() => schedulePhoneTest(ready, undefined, now, true)).toThrow(
      /three minutes/,
    );
  });
  it("saves the chosen order and hours without starting or arming calls", () => {
    const { s, setup } = fixture();
    const next = preparePhoneTest(s, setup, now);
    expect(next.assignments[0].volunteerId).toBe(setup.originalId);
    expect(next.shifts[0].start).toBe(setup.start);
    expect(next.paused).toBe(true);
    expect(next.calls).toEqual([]);
    expect(next.phoneTest?.armedAt).toBeUndefined();
    expect(next.phoneTest?.runId).toBeTruthy();
  });
  it("keeps previous outcomes in history and preserves the allowance", () => {
    const { s, setup } = fixture();
    s.phoneTest!.startedAt = now;
    s.calls = [
      {
        id: "old",
        status: "completed",
        volunteerId: setup.replacementId,
      } as (typeof s.calls)[number],
    ];
    const next = preparePhoneTest(s, setup, now);
    expect(next.phoneTest?.history?.[0].calls[0].id).toBe("old");
    expect(next.phoneTest?.runsScheduled).toBe(1);
    const armed = schedulePhoneTest(next, "2026-10-11T21:02:00.000Z", now);
    expect(armed.phoneTest?.runsScheduled).toBe(2);
    armed.paused = true;
    const reset = preparePhoneTest(armed, setup, now);
    expect(reset.phoneTest?.runsScheduled).toBe(2);
  });
  it("blocks active runs, unreleased numbers, unknown participants and invalid hours", () => {
    const { s, setup } = fixture();
    expect(() =>
      preparePhoneTest({ ...s, paused: false }, setup, now),
    ).toThrow();
    expect(() =>
      preparePhoneTest(
        {
          ...s,
          phoneTest: { ...s.phoneTest!, allocationNumber: "+12025550100" },
        },
        setup,
        now,
      ),
    ).toThrow();
    expect(() =>
      preparePhoneTest(s, { ...setup, replacementId: setup.originalId }, now),
    ).toThrow();
    expect(() =>
      preparePhoneTest(s, { ...setup, originalId: "unknown" }, now),
    ).toThrow();
    expect(() => preparePhoneTest(s, { ...setup, start: now }, now)).toThrow();
    expect(() =>
      preparePhoneTest(s, { ...setup, end: setup.start }, now),
    ).toThrow();
    vi.stubEnv("VOICE_ALLOWED_PHONES", "[]");
    expect(() => preparePhoneTest(s, setup, now)).toThrow();
  });
  it("permits only the explicitly extended next run while preserving past usage", () => {
    const { s, setup } = fixture();
    s.phoneTest!.runsScheduled = 3;
    vi.stubEnv("VOICE_TEST_RUN_LIMIT", "4");
    const prepared = preparePhoneTest(s, setup, now);
    expect(prepared.phoneTest?.runLimit).toBe(4);
    const armed = schedulePhoneTest(prepared, undefined, now, true);
    expect(armed.phoneTest?.runsScheduled).toBe(4);
    armed.paused = true;
    expect(() => preparePhoneTest(armed, setup, now)).toThrow(/test-run/);
  });
  it("refuses an exhausted allowance and an ended service window", () => {
    const { s, setup } = fixture();
    s.phoneTest!.runsScheduled = 3;
    expect(() => preparePhoneTest(s, setup, now)).toThrow(/test-run/);
    s.phoneTest!.runsScheduled = 0;
    vi.stubEnv("VOICE_SERVICE_ENDS_AT", now);
    expect(() => preparePhoneTest(s, setup, now)).toThrow(/window/);
  });
  it("extends the allowance to fifty without erasing previous usage or arming a call", () => {
    const { s, setup } = fixture();
    s.phoneTest!.runsScheduled = 4;
    vi.stubEnv("VOICE_TEST_RUN_LIMIT", "50");
    const ready = preparePhoneTest(s, setup, now);
    expect(ready.phoneTest?.runsScheduled).toBe(4);
    expect(ready.phoneTest?.runLimit).toBe(50);
    expect(ready.phoneTest?.armedAt).toBeUndefined();
    expect(ready.paused).toBe(true);
    ready.phoneTest!.runsScheduled = 49;
    const last = schedulePhoneTest(ready, undefined, now, true);
    expect(last.phoneTest?.runsScheduled).toBe(50);
    last.paused = true;
    expect(() => preparePhoneTest(last, setup, now)).toThrow(/test-run/);
  });
  it.each(["51", "-1", "Infinity", "abc"])(
    "rejects invalid run allowance %s",
    (value) => {
      vi.stubEnv("VOICE_TEST_RUN_LIMIT", value);
      expect(phoneTestRunLimit()).toBe(3);
    },
  );
});
