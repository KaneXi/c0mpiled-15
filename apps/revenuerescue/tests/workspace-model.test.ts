import { describe, expect, it } from "vitest";
import { applyWorkspaceAction, createInitialWorkspaceState } from "../src/demo/workspace-model";
import type { WorkspaceAction, WorkspaceState } from "../src/domain/demo-types";

function act(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  const result = applyWorkspaceAction(state, action);
  expect(result.error, result.message).not.toBe(true);
  return result.state;
}
function reject(state: WorkspaceState, action: WorkspaceAction) {
  const saved = JSON.stringify(state);
  const result = applyWorkspaceAction(state, action);
  expect(result.error).toBe(true);
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(saved);
}

describe("mode isolation and current-state confirmation", () => {
  it("switches modes without changing committed data or versions", () => {
    let state = createInitialWorkspaceState();
    state = act(state, { type: "BUSINESS_ACTION", mode: "business", action: { type: "DRAFT", id: "inquiry-lena" } });
    const business = state.business;
    const versions = state.versions;
    state = act(state, { type: "SWITCH_MODE", mode: "volunteers" });
    expect(state.business).toBe(business);
    expect(state.versions).toBe(versions);
    const volunteers = state.volunteers;
    state = act(state, { type: "VOLUNTEER_ACTION", mode: "volunteers", action: { type: "DRAFT", id: "registration-eli" } });
    expect(state.business).toBe(business);
    expect(state.volunteers).not.toBe(volunteers);
    expect(state.versions).toEqual({ business: { revision: 1, generation: 0 }, volunteers: { revision: 1, generation: 0 } });
  });

  it("rejects stale-mode actions and crossed envelopes without changing either workspace", () => {
    const initial = createInitialWorkspaceState();
    reject(initial, { type: "VOLUNTEER_ACTION", mode: "volunteers", action: { type: "DRAFT", id: "registration-eli" } });
    const volunteers = act(initial, { type: "SWITCH_MODE", mode: "volunteers" });
    reject(volunteers, { type: "BUSINESS_ACTION", mode: "business", action: { type: "DRAFT", id: "inquiry-lena" } });
    reject(volunteers, { type: "BUSINESS_ACTION", mode: "volunteers", action: { type: "RESET" } } as unknown as WorkspaceAction);
  });

  it("resets only the active mode and changes its generation", () => {
    let state = createInitialWorkspaceState();
    state = act(state, { type: "BUSINESS_ACTION", mode: "business", action: { type: "DRAFT", id: "inquiry-lena" } });
    const business = state.business;
    state = act(state, { type: "SWITCH_MODE", mode: "volunteers" });
    state = act(state, { type: "VOLUNTEER_ACTION", mode: "volunteers", action: { type: "DRAFT", id: "registration-eli" } });
    state = act(state, { type: "VOLUNTEER_ACTION", mode: "volunteers", action: { type: "RESET" } });
    expect(state.business).toBe(business);
    expect(state.volunteers).toEqual(createInitialWorkspaceState().volunteers);
    expect(state.versions.volunteers).toEqual({ revision: 2, generation: 1 });
    expect(state.versions.business).toEqual({ revision: 1, generation: 0 });
  });

  it("rejects a proposal after intervening edits or reset, even if the slot remains free", () => {
    let state = createInitialWorkspaceState();
    const expected = { ...state.versions.business };
    state = act(state, { type: "BUSINESS_ACTION", mode: "business", action: { type: "DRAFT", id: "inquiry-lena" } });
    reject(state, { type: "BUSINESS_ACTION", mode: "business", expected, action: { type: "BOOK", inquiryId: "inquiry-lena", resourceId: "theo", start: "2026-10-12T13:00:00-04:00", durationMinutes: 60 } });
    const beforeReset = { ...state.versions.business };
    state = act(state, { type: "BUSINESS_ACTION", mode: "business", action: { type: "RESET" } });
    reject(state, { type: "BUSINESS_ACTION", mode: "business", expected: { revision: state.versions.business.revision, generation: beforeReset.generation }, action: { type: "DRAFT", id: "inquiry-lena" } });
  });

  it("rechecks actual conflicts even when the expected version matches", () => {
    let state = createInitialWorkspaceState();
    reject(state, { type: "BUSINESS_ACTION", mode: "business", expected: state.versions.business, action: { type: "BOOK", inquiryId: "inquiry-lena", resourceId: "maya", start: "2026-10-12T11:00:00-04:00", durationMinutes: 60 } });
    state = act(state, { type: "SWITCH_MODE", mode: "volunteers" });
    reject(state, { type: "VOLUNTEER_ACTION", mode: "volunteers", expected: state.versions.volunteers, action: { type: "ASSIGN", registrationId: "registration-eli", shiftId: "shift-monday-sorting" } });
    state = act(state, { type: "VOLUNTEER_ACTION", mode: "volunteers", expected: state.versions.volunteers, action: { type: "ASSIGN", registrationId: "registration-eli", shiftId: "shift-monday-packing" } });
    expect(state.versions.volunteers.revision).toBe(1);
  });

  it("a volunteer voice registration cannot create a business inquiry or assignment", () => {
    let state = act(createInitialWorkspaceState(), { type: "SWITCH_MODE", mode: "volunteers" });
    const business = state.business;
    const assignments = state.volunteers.assignments;
    state = act(state, { type: "VOLUNTEER_ACTION", mode: "volunteers", action: { type: "REGISTER", registration: { name: "Sample caller", email: "", roleInterests: [], availability: [], notes: "Clarify dates and role.", contactPermission: false, source: "voice" } } });
    expect(state.business).toBe(business);
    expect(state.volunteers.assignments).toBe(assignments);
    expect(state.volunteers.registrations[0]).toMatchObject({ status: "REGISTERED", contactPermission: false, availability: [] });
  });
});
