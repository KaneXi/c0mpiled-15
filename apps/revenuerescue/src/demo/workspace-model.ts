import type { WorkspaceAction, WorkspaceActionResult, WorkspaceState } from "../domain/demo-types";
import { applyAction, createInitialState } from "./model";
import { applyVolunteerAction, createInitialVolunteerState } from "./volunteer-model";

export function createInitialWorkspaceState(): WorkspaceState {
  return { activeMode: "business", business: createInitialState(), volunteers: createInitialVolunteerState(), versions: { business: { revision: 0, generation: 0 }, volunteers: { revision: 0, generation: 0 } } };
}

export function applyWorkspaceAction(state: WorkspaceState, action: WorkspaceAction): WorkspaceActionResult {
  const fail = (message: string): WorkspaceActionResult => ({ state, message, error: true });
  if (action.type === "SWITCH_MODE") {
    if (action.mode !== "business" && action.mode !== "volunteers") return fail("Choose Business or Volunteers.");
    if (action.mode === state.activeMode) return { state, message: "This workspace is already open." };
    return { state: { ...state, activeMode: action.mode }, message: `${action.mode === "business" ? "Business" : "Volunteers"} workspace opened. Its saved sample changes are preserved.` };
  }
  if (action.type !== "BUSINESS_ACTION" && action.type !== "VOLUNTEER_ACTION") return fail("Choose a supported workspace action.");
  if ((action.type === "BUSINESS_ACTION" && action.mode !== "business") || (action.type === "VOLUNTEER_ACTION" && action.mode !== "volunteers")) return fail("This action belongs to a different workspace.");
  if (action.mode !== state.activeMode) return fail("Switch to the matching workspace before confirming this action.");
  const version = state.versions[action.mode];
  if (!version) return fail("This workspace is unavailable.");
  if (action.expected && (action.expected.revision !== version.revision || action.expected.generation !== version.generation)) return fail("This suggestion is out of date. Review the current workspace before confirming.");
  const result = action.type === "BUSINESS_ACTION" ? applyAction(state.business, action.action) : applyVolunteerAction(state.volunteers, action.action);
  if (result.error) return fail(result.message);
  return {
    state: {
      ...state,
      ...(action.type === "BUSINESS_ACTION" ? { business: result.state as WorkspaceState["business"] } : { volunteers: result.state as WorkspaceState["volunteers"] }),
      versions: { ...state.versions, [action.mode]: { revision: version.revision + 1, generation: version.generation + (action.action.type === "RESET" ? 1 : 0) } },
    },
    message: result.message,
  };
}
