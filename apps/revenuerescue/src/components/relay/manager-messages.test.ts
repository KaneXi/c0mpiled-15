import assert from "node:assert/strict";
import { test } from "node:test";
import type { RelayState } from "../../relay/contracts";
import { managerMessages } from "./manager-messages";

const at = "2026-10-11T23:00:00.000Z";
function fixture() {
  return {
    volunteers: [{ id: "first", name: "First" }, { id: "backup", name: "Backup" }],
    shifts: [{ id: "shift", title: "Welcome desk", start: at, end: "2026-10-12T00:00:00.000Z" }],
    assignments: [],
    calls: [{ id: "call", shiftId: "shift", volunteerId: "backup", status: "completed", createdAt: at, completedAt: at, result: { outcome: "confirmed", confidence: 0.95, clarification: "" } }],
  } as unknown as RelayState;
}
test("a positive model result without an assignment remains a manager warning", () => {
  const messages = managerMessages(fixture());
  assert.equal(messages[0].label, "Needs attention");
  assert.equal(messages[0].kind, "attention");
});
test("past refusals remain visible after a new task is created", () => {
  const state = fixture();
  const call = { ...state.calls[0], id: "old-call", result: { ...state.calls[0].result!, outcome: "declined" as const } };
  state.phoneTest = { stage: "ready", detail: "", updatedAt: at, events: [], history: [{ endedAt: at, shift: state.shifts[0], calls: [call], assignmentNames: [] }] };
  assert.equal(managerMessages(state).filter((item) => item.previous && item.label === "Unavailable").length, 1);
});
