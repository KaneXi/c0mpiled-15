import { afterEach, describe, expect, it, vi } from "vitest";
import { createRelayState } from "../src/relay/seed";
import {
  addVoiceVolunteer,
  voiceParticipantAllowed,
} from "../src/relay/voice/participants";
import { preparePhoneTest } from "../src/relay/voice/control";
const now = "2026-10-11T23:00:00.000Z";
const person = {
  name: "Recording Participant",
  phone: "+12025550188",
  roles: ["welcome"],
  preferredRoles: [],
  availability: [],
  timezone: "America/New_York",
  quietHours: { start: 22, end: 8 },
  callingConsent: true,
  recordingConsent: false,
  optedOut: false,
  active: true,
};
afterEach(() => vi.unstubAllEnvs());
describe("manager-created live volunteers", () => {
  it("adds a consenting participant without changing calls and permits selection in the next task", () => {
    const state = createRelayState("test", now);
    state.paused = true;
    state.phoneTest = {
      mode: "outbound",
      stage: "stopped",
      detail: "Ready",
      updatedAt: now,
      events: [],
    };
    vi.stubEnv(
      "VOICE_ALLOWED_PHONES",
      JSON.stringify(state.volunteers.map((row) => row.phone)),
    );
    const saved = addVoiceVolunteer(state, person, now);
    const added = saved.volunteers.at(-1)!;
    expect(voiceParticipantAllowed(added)).toBe(true);
    expect(saved.calls).toEqual(state.calls);
    expect(saved.phoneTest).toEqual(state.phoneTest);
    expect(saved.shifts).toEqual(state.shifts);
    const original = state.volunteers.find(
      (row) => row.id !== state.managerVolunteerId,
    )!;
    const ready = preparePhoneTest(
      saved,
      {
        originalId: original.id,
        replacementId: added.id,
        start: "2026-10-11T23:20:00.000Z",
        end: "2026-10-12T00:20:00.000Z",
      },
      now,
    );
    expect(ready.phoneTest?.replacementVolunteerId).toBe(added.id);
    expect(ready.phoneTest?.armedAt).toBeUndefined();
  });
  it("rejects duplicates, invalid countries, forged approval and additions during an active inquiry", () => {
    const state = createRelayState("test", now);
    state.paused = true;
    const saved = addVoiceVolunteer(state, person, now);
    expect(() => addVoiceVolunteer(saved, person, now)).toThrow(/already/);
    expect(() =>
      addVoiceVolunteer(state, { ...person, phone: "+442079460123" }, now),
    ).toThrow(/US/);
    expect(() =>
      addVoiceVolunteer(
        state,
        { ...person, callingApprovedByManager: true },
        now,
      ),
    ).toThrow();
    expect(() =>
      addVoiceVolunteer({ ...state, paused: false }, person, now),
    ).toThrow(/Stop/);
    const unconsented = addVoiceVolunteer(
      state,
      { ...person, callingConsent: false },
      now,
    ).volunteers.at(-1)!;
    expect(voiceParticipantAllowed(unconsented)).toBe(false);
    expect(
      voiceParticipantAllowed({ ...unconsented, callingConsent: true }),
    ).toBe(false);
  });
});
