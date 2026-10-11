import { describe, expect, it } from "vitest";
import { applyVolunteerAction, createInitialVolunteerState, DEMO_NOW, shiftEligibility, volunteerResults } from "../src/demo/volunteer-model";
import type { RegistrationInput, VolunteerAction, VolunteerState } from "../src/domain/demo-types";

const eli = "registration-eli";
const packing = "shift-monday-packing";
const latePacking = "shift-monday-late-packing";
function act(state: VolunteerState, action: VolunteerAction, now?: string): VolunteerState {
  const result = applyVolunteerAction(state, action, now);
  expect(result.error, result.message).not.toBe(true);
  return result.state;
}
function reject(state: VolunteerState, action: VolunteerAction, now?: string) {
  const saved = JSON.stringify(state);
  const result = applyVolunteerAction(state, action, now);
  expect(result.error).toBe(true);
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(saved);
  return result;
}
const voice: RegistrationInput = { name: "Sample caller", email: "", roleInterests: [], availability: [], notes: "Maybe next week; clarify role, date, and contact details.", contactPermission: false, source: "voice" };

describe("volunteer registration and follow-up", () => {
  it("keeps voice intake unassigned with uncertainty and no invented contact permission", () => {
    const initial = createInitialVolunteerState();
    const state = act(initial, { type: "REGISTER", registration: voice });
    expect(state.registrations[0]).toMatchObject({ status: "REGISTERED", source: "voice", email: "", contactPermission: false, availability: [], notes: voice.notes });
    expect(state.assignments).toBe(initial.assignments);
    expect(shiftEligibility(state, state.registrations[0].id, packing).allowed).toBe(false);
  });

  it("allows local draft review without permission but blocks approval and simulated sending", () => {
    let state = act(createInitialVolunteerState(), { type: "REGISTER", registration: voice });
    const id = state.registrations[0].id;
    state = act(state, { type: "DRAFT", id });
    state = act(state, { type: "EDIT_DRAFT", id, text: "Please clarify your availability." });
    reject(state, { type: "APPROVE", id });
    reject(state, { type: "SEND", id });
  });

  it("requires exact approval, clears it after edits, and permits only one sample send", () => {
    let state = createInitialVolunteerState();
    reject(state, { type: "SEND", id: eli });
    state = act(state, { type: "DRAFT", id: eli });
    state = act(state, { type: "APPROVE", id: eli });
    state = act(state, { type: "EDIT_DRAFT", id: eli, text: "Would Monday afternoon work?" });
    expect(state.registrations.find((item) => item.id === eli)?.approvedDraft).toBeNull();
    reject(state, { type: "SEND", id: eli });
    state = act(state, { type: "APPROVE", id: eli });
    const tampered = { ...state, registrations: state.registrations.map((item) => item.id === eli ? { ...item, draft: "Changed after approval" } : item) };
    reject(tampered, { type: "SEND", id: eli });
    state = act(state, { type: "SEND", id: eli });
    reject(state, { type: "SEND", id: eli });
    reject(state, { type: "DRAFT", id: eli });
    expect(state.assignments).toEqual(createInitialVolunteerState().assignments);
  });

  it("invalidates approval when saved facts change and rejects edits invalidating assigned shifts", () => {
    let state = act(createInitialVolunteerState(), { type: "DRAFT", id: eli });
    state = act(state, { type: "APPROVE", id: eli });
    state = act(state, { type: "UPDATE_REGISTRATION", id: eli, changes: { notes: "Please confirm Monday afternoon." } });
    expect(state.registrations.find((item) => item.id === eli)).toMatchObject({ followUp: "DRAFT", approvedDraft: null });
    reject(state, { type: "UPDATE_REGISTRATION", id: "registration-ben", changes: { availability: [] } });
    reject(state, { type: "UPDATE_REGISTRATION", id: "registration-ben", changes: { roleInterests: ["sorting"] } });
  });

  it("checks availability, roles, capacity, and duplicates before assignment", () => {
    let state = createInitialVolunteerState();
    expect(shiftEligibility(state, eli, packing)).toMatchObject({ allowed: true, remainingPlaces: 1 });
    expect(shiftEligibility(state, eli, "shift-monday-sorting")).toMatchObject({ allowed: false, remainingPlaces: 0 });
    reject(state, { type: "ASSIGN", registrationId: "registration-june", shiftId: "shift-tuesday-welcome" });
    reject(state, { type: "ASSIGN", registrationId: eli, shiftId: "shift-tuesday-welcome" });
    state = act(state, { type: "ASSIGN", registrationId: eli, shiftId: packing });
    reject(state, { type: "ASSIGN", registrationId: eli, shiftId: packing });
    expect(shiftEligibility(state, "registration-olivia", packing).allowed).toBe(false);
  });

  it("counts completed places against capacity", () => {
    const initial = createInitialVolunteerState();
    const state = { ...initial, assignments: [...initial.assignments, { id: "completed-packing", registrationId: "registration-olivia", shiftId: packing, status: "COMPLETED" as const, completedMinutes: 120 }] };
    expect(shiftEligibility(state, eli, packing)).toMatchObject({ allowed: false, remainingPlaces: 0 });
  });
});

describe("assignment changes and fixed simulation time", () => {
  it("uses half-open intervals so adjacent shifts are allowed and overlaps are refused", () => {
    let state = createInitialVolunteerState();
    state = act(state, { type: "ASSIGN", registrationId: eli, shiftId: packing });
    state = act(state, { type: "CANCEL", assignmentId: "assignment-noor-sorting" });
    reject(state, { type: "ASSIGN", registrationId: eli, shiftId: "shift-monday-sorting" });
    state = act(state, { type: "ASSIGN", registrationId: eli, shiftId: latePacking });
    expect(state.assignments.filter((item) => item.registrationId === eli && item.status === "ASSIGNED")).toHaveLength(2);
  });

  it("moves an assignment once and checks replacement state before releasing the original", () => {
    let state = createInitialVolunteerState();
    reject(state, { type: "MOVE", assignmentId: "assignment-ben-packing", shiftId: packing });
    const count = state.assignments.length;
    state = act(state, { type: "MOVE", assignmentId: "assignment-ben-packing", shiftId: latePacking });
    expect(state.assignments).toHaveLength(count);
    expect(state.assignments.find((item) => item.id === "assignment-ben-packing")?.shiftId).toBe(latePacking);
    expect(shiftEligibility(state, eli, packing).remainingPlaces).toBe(2);
    const assigned = act(state, { type: "ASSIGN", registrationId: eli, shiftId: packing });
    const own = assigned.assignments.find((item) => item.registrationId === eli)!;
    reject(assigned, { type: "MOVE", assignmentId: own.id, shiftId: latePacking });
    expect(assigned.assignments.find((item) => item.id === own.id)?.shiftId).toBe(packing);
  });

  it("skips the moved assignment itself but preserves other conflicting assignments", () => {
    let state = createInitialVolunteerState();
    state = act(state, { type: "CANCEL", assignmentId: "assignment-noor-sorting" });
    state = act(state, { type: "ASSIGN", registrationId: eli, shiftId: packing });
    const own = state.assignments.find((item) => item.registrationId === eli)!;
    state = act(state, { type: "MOVE", assignmentId: own.id, shiftId: "shift-monday-sorting" });
    expect(state.assignments.find((item) => item.id === own.id)?.shiftId).toBe("shift-monday-sorting");
  });

  it("rejects assigning and moving into ended shifts and prevents early completion", () => {
    const state = createInitialVolunteerState();
    reject(state, { type: "ASSIGN", registrationId: "registration-olivia", shiftId: "shift-morning-welcome" });
    reject(state, { type: "MOVE", assignmentId: "assignment-ben-packing", shiftId: "shift-morning-welcome" });
    reject(state, { type: "COMPLETE", assignmentId: "assignment-ben-packing", completedMinutes: 120 });
    reject(state, { type: "COMPLETE", assignmentId: "assignment-olivia-morning", completedMinutes: 120 }, "invalid");
    const completed = act(state, { type: "COMPLETE", assignmentId: "assignment-ben-packing", completedMinutes: 120 }, "2026-10-12T15:00:00-04:00");
    expect(completed.assignments.find((item) => item.id === "assignment-ben-packing")?.status).toBe("COMPLETED");
  });

  it("bounds completion, records zero honestly, and refuses repeated completion or edits", () => {
    let state = createInitialVolunteerState();
    for (const completedMinutes of [-1, 121, 2.5, NaN]) reject(state, { type: "COMPLETE", assignmentId: "assignment-olivia-morning", completedMinutes });
    const originalMinutes = volunteerResults(state).completedMinutes;
    state = act(state, { type: "COMPLETE", assignmentId: "assignment-olivia-morning", completedMinutes: 0 });
    expect(state.activity[0].text).toContain("No time recorded");
    expect(volunteerResults(state).completedMinutes).toBe(originalMinutes);
    reject(state, { type: "COMPLETE", assignmentId: "assignment-olivia-morning", completedMinutes: 120 });
    reject(state, { type: "CANCEL", assignmentId: "assignment-olivia-morning" });
    reject(state, { type: "MOVE", assignmentId: "assignment-olivia-morning", shiftId: packing });
  });

  it("cancellation releases places; withdrawal preserves completed work and hours", () => {
    let state = createInitialVolunteerState();
    reject(state, { type: "WITHDRAW", id: "registration-ben" });
    const minutes = volunteerResults(state).completedMinutes;
    state = act(state, { type: "CANCEL", assignmentId: "assignment-ben-packing" });
    expect(shiftEligibility(state, eli, packing).remainingPlaces).toBe(2);
    state = act(state, { type: "WITHDRAW", id: "registration-ben" });
    expect(volunteerResults(state).completedMinutes).toBe(minutes);
    expect(state.assignments.find((item) => item.id === "assignment-ben-morning")?.status).toBe("COMPLETED");
    reject(state, { type: "ASSIGN", registrationId: "registration-ben", shiftId: packing });
    reject(state, { type: "DRAFT", id: "registration-ben" });
  });

  it("never advances the simulation clock as activity is added", () => {
    let state = createInitialVolunteerState();
    for (let index = 0; index < 20; index++) state = act(state, { type: "UPDATE_REGISTRATION", id: eli, changes: { notes: `Sample update ${index}` } });
    expect(state.activity.every((item) => item.at === DEMO_NOW)).toBe(true);
    reject(state, { type: "COMPLETE", assignmentId: "assignment-ben-packing", completedMinutes: 120 });
    expect(act(state, { type: "RESET" })).toEqual(createInitialVolunteerState());
  });
});
