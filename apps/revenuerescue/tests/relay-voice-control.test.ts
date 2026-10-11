import { afterEach, describe, expect, it, vi } from "vitest";
import { createRelayState } from "../src/relay/seed";
import {
  preparePhoneTest,
  schedulePhoneTest,
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
  it("refuses an exhausted allowance and an ended service window", () => {
    const { s, setup } = fixture();
    s.phoneTest!.runsScheduled = 3;
    expect(() => preparePhoneTest(s, setup, now)).toThrow(/three-run/);
    s.phoneTest!.runsScheduled = 0;
    vi.stubEnv("VOICE_SERVICE_ENDS_AT", now);
    expect(() => preparePhoneTest(s, setup, now)).toThrow(/window/);
  });
});
