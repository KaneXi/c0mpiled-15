import { describe, expect, it } from "vitest";
import { createRelayState } from "../src/relay/seed";
import {
  openingPrompt,
  availabilityQuestion,
  spokenShiftWindow,
} from "../src/relay/voice/prompts";
import type { Call } from "../src/relay/contracts";
const state = createRelayState("prompts", "2026-10-11T21:00:00.000Z");
const shift = {
  ...state.shifts[0],
  title: "Volunteer check-in desk",
  start: "2026-10-11T22:15:00.000Z",
  end: "2026-10-11T23:15:00.000Z",
};
const person = { ...state.volunteers[2], name: "Sample Replacement" };
describe("explicit local-time telephone questions", () => {
  it("states who needs cover, the exact hours and a feasibility question", () => {
    const text = openingPrompt(
      { purpose: "replacement" } as Call,
      shift,
      person,
      "Sample Original",
    );
    expect(text).toContain("Sample Original cannot attend");
    expect(text).toContain("October 11, 2026");
    expect(text).toContain("6:15 PM to 7:15 PM Eastern Daylight Time");
    expect(text).toContain("Can you cover that entire time slot?");
    expect(text).not.toContain("22:15");
    expect(availabilityQuestion(shift, person)).toContain("6:15 PM to 7:15 PM");
  });
  it("announces both dates for an overnight shift", () => {
    const text = spokenShiftWindow(
      { ...shift, start: "2026-10-12T03:30:00Z", end: "2026-10-12T05:00:00Z" },
      "America/New_York",
    );
    expect(text).toContain("October 11, 2026");
    expect(text).toContain("October 12, 2026");
    expect(text).toContain("11:30 PM");
    expect(text).toContain("1:00 AM");
  });
  it("distinguishes repeated local hours at the daylight-saving transition", () => {
    const text = spokenShiftWindow(
      { ...shift, start: "2026-11-01T05:30:00Z", end: "2026-11-01T06:30:00Z" },
      "America/New_York",
    );
    expect(text).toContain("1:30 AM Eastern Daylight Time");
    expect(text).toContain("1:30 AM Eastern Standard Time");
  });
});
