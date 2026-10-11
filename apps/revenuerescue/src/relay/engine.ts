import {
  interpretationSchema,
  phoneSchema,
  shiftInputSchema,
  volunteerInputSchema,
  type Activity,
  type Assignment,
  type Call,
  type Candidate,
  type DomainCommand,
  type Incident,
  type Interpretation,
  type RelayState,
  type Shift,
  type Volunteer,
} from "./contracts";
export { createRelayState } from "./seed";

const MINUTE = 60_000;
const openCall = (call: Call) =>
  ["queued", "in_progress", "analyzing"].includes(call.status);
const activeAssignment = (assignment: Assignment) =>
  assignment.status !== "cancelled";
const reliable = (assignment: Assignment) =>
  ["assigned", "confirmed"].includes(assignment.status);
const overlap = (
  a: { start: string; end: string },
  b: { start: string; end: string },
) =>
  Date.parse(a.start) < Date.parse(b.end) &&
  Date.parse(b.start) < Date.parse(a.end);
const id = (prefix: string, rows: { id: string }[]) => {
  let value = rows.length + 1;
  while (rows.some((row) => row.id === `${prefix}-${value}`)) value++;
  return `${prefix}-${value}`;
};
const clock = (nowISO: string) => {
  const value = Date.parse(nowISO);
  if (!Number.isFinite(value))
    throw new Error("A valid current time is required.");
  return value;
};
const findShift = (state: RelayState, shiftId: string) => {
  const shift = state.shifts.find((row) => row.id === shiftId);
  if (!shift)
    throw new Error("This shift no longer exists. Refresh the schedule.");
  return shift;
};
const findVolunteer = (state: RelayState, volunteerId: string) => {
  const volunteer = state.volunteers.find((row) => row.id === volunteerId);
  if (!volunteer)
    throw new Error(
      "This volunteer no longer exists. Refresh the volunteer list.",
    );
  return volunteer;
};
const unchangedOr = (original: RelayState, next: RelayState) =>
  JSON.stringify(original) === JSON.stringify(next) ? original : next;
function record(
  state: RelayState,
  nowISO: string,
  activity: Omit<Activity, "id" | "at">,
) {
  state.activity.push({
    id: id("activity", state.activity),
    at: nowISO,
    ...activity,
  });
}
function reportCall(
  state: RelayState,
  call: Call,
  nowISO: string,
  outcome: string,
  summary: string,
  nextAction: string,
) {
  const name =
    state.volunteers.find((row) => row.id === call.volunteerId)?.name ??
    "Volunteer";
  record(state, nowISO, {
    kind: "call",
    callId: call.id,
    volunteerId: call.volunteerId,
    transport: call.transport,
    outcome,
    text: `${name}: ${summary}`,
    nextAction,
  });
}
function cancelCall(
  state: RelayState,
  call: Call,
  nowISO: string,
  reason: string,
) {
  if (!openCall(call)) return;
  call.status = "cancelled";
  call.completedAt = nowISO;
  call.error = reason;
  reportCall(
    state,
    call,
    nowISO,
    "cancelled",
    reason,
    "No further action on this call.",
  );
}
function stopIncidentCalls(
  state: RelayState,
  incidentId: string,
  nowISO: string,
  reason: string,
) {
  for (const call of state.calls.filter((row) => row.incidentId === incidentId))
    cancelCall(state, call, nowISO, reason);
}
function contactAllowed(volunteer: Volunteer) {
  return (
    volunteer.active &&
    volunteer.callingConsent &&
    !volunteer.optedOut &&
    phoneSchema.safeParse(volunteer.phone).success
  );
}
function isQuiet(volunteer: Volunteer, nowISO: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: volunteer.timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(nowISO)),
  );
  const { start, end } = volunteer.quietHours;
  return start === end
    ? false
    : start < end
      ? hour >= start && hour < end
      : hour >= start || hour < end;
}
function availabilityCovers(volunteer: Volunteer, shift: Shift) {
  let coveredUntil = Date.parse(shift.start);
  for (const window of [...volunteer.availability].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  )) {
    if (Date.parse(window.start) > coveredUntil) break;
    if (Date.parse(window.end) > coveredUntil)
      coveredUntil = Date.parse(window.end);
    if (coveredUntil >= Date.parse(shift.end)) return true;
  }
  return false;
}
function assignmentProblem(
  state: RelayState,
  volunteer: Volunteer,
  shift: Shift,
  ignoreAssignmentId?: string,
) {
  if (!volunteer.active) return "The volunteer is inactive.";
  if (!volunteer.roles.includes(shift.role))
    return "The volunteer does not have the required role.";
  if (!availabilityCovers(volunteer, shift))
    return "The volunteer has not provided availability for the entire shift.";
  for (const assignment of state.assignments) {
    if (
      assignment.id === ignoreAssignmentId ||
      !activeAssignment(assignment) ||
      assignment.volunteerId !== volunteer.id
    )
      continue;
    const other = state.shifts.find((row) => row.id === assignment.shiftId);
    if (other && other.status !== "cancelled" && overlap(other, shift))
      return "The volunteer already has an overlapping assignment.";
  }
  return undefined;
}
function requireOpenShift(shift: Shift, nowISO: string) {
  if (shift.status === "cancelled")
    throw new Error("This shift was cancelled. Create a new draft instead.");
  if (Date.parse(shift.end) <= clock(nowISO))
    throw new Error("This shift has ended. Choose a future shift.");
}

export function coverage(state: RelayState, shiftId: string) {
  const shift = findShift(state, shiftId);
  const assignments = state.assignments.filter(
    (row) => row.shiftId === shiftId && activeAssignment(row),
  );
  const assigned = assignments.length;
  const confirmed = assignments.filter(
    (row) => row.status === "confirmed",
  ).length;
  const gap =
    shift.status === "cancelled"
      ? 0
      : Math.max(0, shift.required - assignments.filter(reliable).length);
  const status =
    shift.status === "cancelled"
      ? "Cancelled"
      : gap === 0
        ? "Covered"
        : assigned >= shift.required
          ? "At risk"
          : "Uncovered";
  return { required: shift.required, assigned, confirmed, gap, status };
}

export function eligibleCandidates(
  state: RelayState,
  shiftId: string,
  nowISO: string,
): Candidate[] {
  const shift = findShift(state, shiftId);
  if (shift.status !== "published" || Date.parse(shift.end) <= clock(nowISO))
    return [];
  return state.volunteers
    .flatMap((volunteer) => {
      if (
        volunteer.id === state.managerVolunteerId ||
        !contactAllowed(volunteer) ||
        assignmentProblem(state, volunteer, shift)
      )
        return [];
      const declined = state.calls.some(
        (call) =>
          call.shiftId === shiftId &&
          (call.shiftVersion === undefined ||
            call.shiftVersion === shift.version) &&
          call.volunteerId === volunteer.id &&
          call.status === "completed" &&
          ["declined", "opt_out"].includes(call.result?.outcome ?? ""),
      );
      if (declined) return [];
      const hours = state.assignments
        .filter(
          (row) => row.volunteerId === volunteer.id && activeAssignment(row),
        )
        .reduce((sum, row) => {
          const assignedShift = state.shifts.find(
            (item) => item.id === row.shiftId,
          );
          return (
            sum +
            (assignedShift &&
            assignedShift.status !== "cancelled" &&
            Date.parse(assignedShift.end) > clock(nowISO)
              ? (Date.parse(assignedShift.end) -
                  Date.parse(assignedShift.start)) /
                3_600_000
              : 0)
          );
        }, 0);
      const preferred = volunteer.preferredRoles.includes(shift.role);
      return [
        {
          volunteerId: volunteer.id,
          score:
            Math.round((100 + (preferred ? 20 : 0) - hours * 5) * 100) / 100,
          reasons: [
            "Available for the entire shift",
            "Qualified with no assignment conflict",
            ...(preferred ? ["Matches preferred role"] : []),
            `${hours.toFixed(1)} assigned hours in upcoming shifts`,
          ],
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        findVolunteer(state, a.volunteerId).name.localeCompare(
          findVolunteer(state, b.volunteerId).name,
        ) ||
        a.volunteerId.localeCompare(b.volunteerId),
    );
}

function addAssignment(
  state: RelayState,
  shift: Shift,
  volunteerId: string,
  nowISO: string,
  confirmed: boolean,
  replacement: boolean,
) {
  requireOpenShift(shift, nowISO);
  const volunteer = findVolunteer(state, volunteerId);
  const problem = assignmentProblem(state, volunteer, shift);
  if (problem) throw new Error(problem);
  if (coverage(state, shift.id).gap === 0)
    throw new Error("This shift already has enough coverage.");
  const active = state.assignments.filter(
    (row) => row.shiftId === shift.id && activeAssignment(row),
  );
  if (active.length >= shift.required) {
    const disrupted = replacement && active.find((row) => !reliable(row));
    if (!disrupted)
      throw new Error(
        "This shift is full. Cancel an assignment before adding another.",
      );
    disrupted.status = "cancelled";
    disrupted.note = `Replaced by ${volunteer.name} after a coverage risk was confirmed.`;
    for (const call of state.calls.filter(
      (row) => row.assignmentId === disrupted.id,
    ))
      cancelCall(state, call, nowISO, "This assignment has been replaced.");
  }
  state.assignments.push({
    id: id("assignment", state.assignments),
    shiftId: shift.id,
    volunteerId,
    status: confirmed ? "confirmed" : "assigned",
    note: confirmed
      ? "Replacement accepted and eligibility revalidated."
      : "Assigned by the manager.",
  });
  record(state, nowISO, {
    kind: "schedule",
    volunteerId,
    text: `${volunteer.name} assigned to ${shift.title}.`,
    nextAction: confirmed
      ? "Coverage restored."
      : "Automatic check-in will follow publication and timing rules.",
  });
}
function resolveCoveredIncidents(state: RelayState, nowISO: string) {
  for (const incident of state.incidents) {
    if (!["pending", "approved"].includes(incident.status)) continue;
    const shift = findShift(state, incident.shiftId);
    if (
      shift.status !== "published" ||
      incident.shiftVersion !== shift.version ||
      Date.parse(shift.end) <= clock(nowISO)
    ) {
      incident.status = "cancelled";
      stopIncidentCalls(
        state,
        incident.id,
        nowISO,
        "The schedule changed or the shift ended. Outreach stopped.",
      );
    } else if (coverage(state, incident.shiftId).gap === 0) {
      incident.status = "covered";
      stopIncidentCalls(
        state,
        incident.id,
        nowISO,
        "Coverage is restored. Outreach stopped.",
      );
    }
  }
}
function invalidCallReason(state: RelayState, call: Call, nowISO: string) {
  const shift = state.shifts.find((row) => row.id === call.shiftId);
  const volunteer = state.volunteers.find((row) => row.id === call.volunteerId);
  if (
    !shift ||
    shift.status !== "published" ||
    Date.parse(shift.end) <= clock(nowISO)
  )
    return "The shift is unavailable or has ended.";
  if (call.shiftVersion !== undefined && call.shiftVersion !== shift.version)
    return "The schedule changed after this call was planned.";
  if (!volunteer || !contactAllowed(volunteer))
    return "Calling permission is unavailable or the volunteer opted out.";
  if (call.purpose === "check_in") {
    const assignment = state.assignments.find(
      (row) => row.id === call.assignmentId,
    );
    if (
      !assignment ||
      !activeAssignment(assignment) ||
      assignment.shiftId !== shift.id ||
      assignment.volunteerId !== volunteer.id
    )
      return "This assignment is no longer active.";
    if (assignmentProblem(state, volunteer, shift, assignment.id))
      return "The assignment no longer meets scheduling requirements.";
  } else {
    const incident = state.incidents.find((row) => row.id === call.incidentId);
    if (
      !incident ||
      incident.status !== "approved" ||
      incident.shiftVersion !== shift.version ||
      !incident.approvedCandidateIds.includes(volunteer.id)
    )
      return "This outreach is no longer approved.";
    if (coverage(state, shift.id).gap === 0)
      return "The shift already has enough coverage.";
    if (
      !eligibleCandidates(state, shift.id, nowISO).some(
        (row) => row.volunteerId === volunteer.id,
      )
    )
      return "This candidate is no longer eligible for the shift.";
    if (
      call.status === "queued" &&
      (incident.attemptedIds.includes(volunteer.id) ||
        incident.attemptedIds.length >= incident.maxAttempts)
    )
      return "The approved outreach limit has been reached.";
  }
  return undefined;
}
function reconcile(state: RelayState, nowISO: string) {
  resolveCoveredIncidents(state, nowISO);
  for (const call of state.calls.filter(openCall)) {
    const reason = invalidCallReason(state, call, nowISO);
    if (reason) cancelCall(state, call, nowISO, reason);
  }
}

export function applyCommand(
  state: RelayState,
  command: DomainCommand,
  nowISO: string,
): RelayState {
  clock(nowISO);
  const next = structuredClone(state);
  switch (command.type) {
    case "SAVE_VOLUNTEER": {
      const input = volunteerInputSchema.parse(command.volunteer);
      const volunteerId = command.id ?? id("volunteer", next.volunteers);
      const previous = command.id
        ? findVolunteer(next, volunteerId)
        : undefined;
      const volunteer = { id: volunteerId, ...input };
      if (previous)
        next.volunteers[next.volunteers.indexOf(previous)] = volunteer;
      else next.volunteers.push(volunteer);
      for (const assignment of next.assignments.filter(
        (row) => row.volunteerId === volunteerId && activeAssignment(row),
      )) {
        const shift = findShift(next, assignment.shiftId);
        const problem = assignmentProblem(
          next,
          volunteer,
          shift,
          assignment.id,
        );
        if (problem) {
          assignment.status = "uncertain";
          assignment.note = problem;
        }
      }
      if (previous && previous.phone !== volunteer.phone) {
        for (const call of next.calls.filter(
          (row) => row.volunteerId === volunteerId,
        ))
          cancelCall(
            next,
            call,
            nowISO,
            "The contact number changed; replan the call with the updated contact.",
          );
      }
      record(next, nowISO, {
        kind: "schedule",
        volunteerId,
        text: `${volunteer.name}'s volunteer record was saved.`,
        nextAction:
          "Scheduling and contact permissions will be checked before any call.",
      });
      break;
    }
    case "SAVE_SHIFT": {
      const input = shiftInputSchema.parse(command.shift);
      if (Date.parse(input.start) <= clock(nowISO))
        throw new Error("Choose a shift start time in the future.");
      if (command.id) {
        const shift = findShift(next, command.id);
        if (shift.status !== "draft")
          throw new Error(
            "Published schedules are locked. Cancel this shift and create a new draft to change its details.",
          );
        const updated: Shift = {
          ...shift,
          ...input,
          version: shift.version + 1,
        };
        if (
          next.assignments.filter(
            (row) => row.shiftId === shift.id && activeAssignment(row),
          ).length > updated.required
        )
          throw new Error(
            "Remove excess assignments before reducing staffing requirements.",
          );
        for (const assignment of next.assignments.filter(
          (row) => row.shiftId === shift.id && activeAssignment(row),
        )) {
          const problem = assignmentProblem(
            next,
            findVolunteer(next, assignment.volunteerId),
            updated,
            assignment.id,
          );
          if (problem)
            throw new Error(
              `The edited shift would invalidate an assignment. ${problem}`,
            );
        }
        next.shifts[next.shifts.indexOf(shift)] = updated;
      } else
        next.shifts.push({
          ...input,
          id: id("shift", next.shifts),
          status: "draft",
          version: 1,
        });
      record(next, nowISO, {
        kind: "schedule",
        text: `${input.title} saved as a draft.`,
        nextAction: "Review assignments and publish when ready.",
      });
      break;
    }
    case "PUBLISH_SHIFT": {
      const shift = findShift(next, command.shiftId);
      requireOpenShift(shift, nowISO);
      if (shift.status === "published") return state;
      if (Date.parse(shift.start) <= clock(nowISO))
        throw new Error("Publish the schedule before the shift starts.");
      for (const assignment of next.assignments.filter(
        (row) => row.shiftId === shift.id && activeAssignment(row),
      )) {
        const problem = assignmentProblem(
          next,
          findVolunteer(next, assignment.volunteerId),
          shift,
          assignment.id,
        );
        if (problem)
          throw new Error(
            `Resolve this assignment before publishing. ${problem}`,
          );
      }
      shift.status = "published";
      shift.version++;
      record(next, nowISO, {
        kind: "schedule",
        text: `${shift.title} published by the manager.`,
        nextAction:
          "Relay will automatically monitor coverage and plan check-ins.",
      });
      break;
    }
    case "CANCEL_SHIFT": {
      const shift = findShift(next, command.shiftId);
      if (shift.status === "cancelled") return state;
      shift.status = "cancelled";
      shift.version++;
      for (const assignment of next.assignments.filter(
        (row) => row.shiftId === shift.id && activeAssignment(row),
      )) {
        assignment.status = "cancelled";
        assignment.note = "The manager cancelled this shift.";
      }
      record(next, nowISO, {
        kind: "schedule",
        text: `${shift.title} cancelled by the manager.`,
        nextAction:
          "All check-ins and replacement outreach for this shift are stopped.",
      });
      break;
    }
    case "ASSIGN": {
      addAssignment(
        next,
        findShift(next, command.shiftId),
        command.volunteerId,
        nowISO,
        false,
        false,
      );
      break;
    }
    case "CANCEL_ASSIGNMENT": {
      const assignment = next.assignments.find(
        (row) => row.id === command.assignmentId,
      );
      if (!assignment)
        throw new Error(
          "This assignment no longer exists. Refresh the schedule.",
        );
      if (!activeAssignment(assignment)) return state;
      assignment.status = "cancelled";
      assignment.note = "Cancelled by the manager.";
      record(next, nowISO, {
        kind: "schedule",
        volunteerId: assignment.volunteerId,
        text: `${findVolunteer(next, assignment.volunteerId).name}'s assignment was cancelled.`,
        nextAction: "Relay will reassess published shift coverage.",
      });
      break;
    }
    case "DECIDE_INCIDENT": {
      const incident = next.incidents.find(
        (row) => row.id === command.incidentId,
      );
      if (!incident || incident.status !== "pending")
        throw new Error(
          "This plan is no longer awaiting a decision. Refresh the attention queue.",
        );
      const shift = findShift(next, incident.shiftId);
      requireOpenShift(shift, nowISO);
      if (
        shift.status !== "published" ||
        incident.shiftVersion !== shift.version ||
        coverage(next, shift.id).gap === 0
      )
        throw new Error(
          "This plan is stale. Refresh the schedule before deciding.",
        );
      if (command.decision === "no") {
        incident.status = "rejected";
        stopIncidentCalls(
          next,
          incident.id,
          nowISO,
          "The manager rejected this outreach plan.",
        );
      } else if (command.decision === "myself") {
        addAssignment(next, shift, next.managerVolunteerId, nowISO, true, true);
        incident.status =
          coverage(next, shift.id).gap === 0 ? "covered" : "pending";
        stopIncidentCalls(
          next,
          incident.id,
          nowISO,
          "The manager chose a manual assignment; this outreach plan is stopped.",
        );
      } else {
        const eligible = new Set(
          eligibleCandidates(next, shift.id, nowISO).map(
            (row) => row.volunteerId,
          ),
        );
        incident.approvedCandidateIds = incident.candidates
          .map((row) => row.volunteerId)
          .filter((value) => eligible.has(value))
          .slice(0, incident.maxAttempts);
        if (incident.approvedCandidateIds.length === 0)
          throw new Error(
            "None of the proposed volunteers remains eligible. Assign someone manually or update the schedule.",
          );
        incident.status = "approved";
        incident.approvedAt = nowISO;
      }
      record(next, nowISO, {
        kind: "approval",
        text:
          command.decision === "yes"
            ? `Approved sequential outreach to ${incident.approvedCandidateIds.length} named candidates for ${shift.title}.`
            : command.decision === "no"
              ? `Outreach declined for ${shift.title}.`
              : `The manager assigned themselves to ${shift.title}.`,
        nextAction:
          command.decision === "yes"
            ? "Relay will call only this approved list, one person at a time."
            : "No calls will be made under this plan.",
      });
      break;
    }
    case "REVOKE_INCIDENT": {
      const incident = next.incidents.find(
        (row) => row.id === command.incidentId,
      );
      if (!incident) throw new Error("This outreach plan no longer exists.");
      if (!["pending", "approved"].includes(incident.status)) return state;
      incident.status = "cancelled";
      stopIncidentCalls(
        next,
        incident.id,
        nowISO,
        "The manager revoked this outreach plan.",
      );
      record(next, nowISO, {
        kind: "approval",
        text: "Outreach approval revoked.",
        nextAction:
          "No further calls or assignments are permitted under this plan.",
      });
      break;
    }
    case "SET_PAUSED": {
      if (next.paused === command.paused) return state;
      next.paused = command.paused;
      record(next, nowISO, {
        kind: "system",
        text: command.paused
          ? "AI calls paused by the manager."
          : "AI calls resumed by the manager.",
        nextAction: command.paused
          ? "No new calls will start. Active calls may finish; monitoring continues."
          : "Queued calls will resume only after permissions, timing and eligibility are rechecked.",
      });
      break;
    }
  }
  reconcile(next, nowISO);
  return unchangedOr(state, next);
}

function enqueue(
  state: RelayState,
  shift: Shift,
  volunteerId: string,
  nowISO: string,
  details: Pick<Call, "purpose" | "attempt"> & {
    assignmentId?: string;
    incidentId?: string;
    dueAt?: string;
  },
) {
  const call: Call = {
    id: id("call", state.calls),
    shiftId: shift.id,
    shiftVersion: shift.version,
    volunteerId,
    status: "queued",
    createdAt: nowISO,
    dueAt: details.dueAt ?? nowISO,
    transport: "simulated",
    transcript: "",
    ...details,
  };
  state.calls.push(call);
  reportCall(
    state,
    call,
    nowISO,
    "queued",
    `${call.purpose === "check_in" ? "Routine check-in" : "Approved replacement call"} queued.`,
    "Relay will automatically start this simulated call when permissions and calling hours allow.",
  );
}

export function monitor(state: RelayState, nowISO: string): RelayState {
  const now = clock(nowISO);
  const next = structuredClone(state);
  reconcile(next, nowISO);
  for (const shift of next.shifts.filter(
    (row) => row.status === "published" && Date.parse(row.end) > now,
  )) {
    if (
      Date.parse(shift.start) - next.settings.checkInLeadMinutes * MINUTE <=
      now
    ) {
      for (const assignment of next.assignments.filter(
        (row) => row.shiftId === shift.id && activeAssignment(row),
      )) {
        const volunteer = findVolunteer(next, assignment.volunteerId);
        if (
          assignment.status === "confirmed" ||
          !contactAllowed(volunteer) ||
          assignmentProblem(next, volunteer, shift, assignment.id)
        )
          continue;
        const calls = next.calls.filter(
          (row) =>
            row.assignmentId === assignment.id &&
            row.purpose === "check_in" &&
            (row.shiftVersion === undefined ||
              row.shiftVersion === shift.version),
        );
        // Provider failures require an explicit retry of the existing call; a tick must not manufacture another attempt.
        if (calls.some((row) => openCall(row) || row.status === "failed"))
          continue;
        const completed = calls.filter((row) => row.status === "completed");
        const last = completed.at(-1);
        if (last && last.result?.outcome !== "no_answer") continue;
        if (completed.length >= next.settings.maxAttempts) continue;
        const dueAt = last?.completedAt
          ? new Date(
              Date.parse(last.completedAt) +
                next.settings.retryMinutes * MINUTE,
            ).toISOString()
          : nowISO;
        if (Date.parse(dueAt) >= Date.parse(shift.end)) continue;
        enqueue(next, shift, volunteer.id, nowISO, {
          purpose: "check_in",
          assignmentId: assignment.id,
          attempt: completed.length + 1,
          dueAt,
        });
      }
    }
    const risk = coverage(next, shift.id);
    // Pending plans remain reviewable as coverage and volunteers change; approved lists are never expanded.
    for (const incident of next.incidents.filter(
      (row) => row.shiftId === shift.id && row.status === "pending",
    )) {
      incident.reason = `${risk.gap} of ${risk.required} required places ${risk.gap === 1 ? "needs" : "need"} reliable coverage.`;
      incident.candidates = eligibleCandidates(next, shift.id, nowISO);
    }
    if (
      risk.gap > 0 &&
      !next.incidents.some(
        (row) =>
          row.shiftId === shift.id &&
          row.shiftVersion === shift.version &&
          row.status !== "covered",
      )
    ) {
      const incident: Incident = {
        id: id("incident", next.incidents),
        shiftId: shift.id,
        shiftVersion: shift.version,
        status: "pending",
        reason: `${risk.gap} of ${risk.required} required places ${risk.gap === 1 ? "needs" : "need"} reliable coverage.`,
        candidates: eligibleCandidates(next, shift.id, nowISO),
        approvedCandidateIds: [],
        attemptedIds: [],
        createdAt: nowISO,
        maxAttempts: Math.max(1, Math.min(next.settings.maxAttempts, 5)),
      };
      next.incidents.push(incident);
      record(next, nowISO, {
        kind: "system",
        text: `${shift.title}: ${incident.reason}`,
        nextAction:
          "Review the proposed candidates and choose Yes, No, or Assign myself.",
      });
    }
    for (const incident of next.incidents.filter(
      (row) => row.shiftId === shift.id && row.status === "approved",
    )) {
      if (
        next.calls.some(
          (row) =>
            row.incidentId === incident.id &&
            (openCall(row) || row.status === "failed"),
        )
      )
        continue;
      const eligible = new Set(
        eligibleCandidates(next, shift.id, nowISO).map(
          (row) => row.volunteerId,
        ),
      );
      const candidateId = incident.approvedCandidateIds.find(
        (value) =>
          !incident.attemptedIds.includes(value) && eligible.has(value),
      );
      if (
        !candidateId ||
        incident.attemptedIds.length >= incident.maxAttempts
      ) {
        incident.status = "exhausted";
        record(next, nowISO, {
          kind: "system",
          text: `Approved outreach exhausted for ${shift.title}.`,
          nextAction:
            "Assign a qualified volunteer manually or update the schedule. No extra candidates will be called.",
        });
      } else
        enqueue(next, shift, candidateId, nowISO, {
          purpose: "replacement",
          incidentId: incident.id,
          attempt: incident.attemptedIds.length + 1,
        });
    }
  }
  return unchangedOr(state, next);
}

export function startNextCall(state: RelayState, nowISO: string): RelayState {
  const now = clock(nowISO);
  if (
    state.paused ||
    state.calls.some(
      (row) => row.status === "in_progress" || row.status === "analyzing",
    )
  )
    return state;
  const next = structuredClone(state);
  reconcile(next, nowISO);
  for (const call of next.calls
    .filter((row) => row.status === "queued" && Date.parse(row.dueAt) <= now)
    .sort(
      (a, b) =>
        Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.id.localeCompare(b.id),
    )) {
    const volunteer = findVolunteer(next, call.volunteerId);
    if (isQuiet(volunteer, nowISO)) continue;
    call.status = "in_progress";
    call.startedAt = nowISO;
    if (call.incidentId) {
      const incident = next.incidents.find(
        (row) => row.id === call.incidentId,
      )!;
      incident.attemptedIds.push(call.volunteerId);
    }
    reportCall(
      next,
      call,
      nowISO,
      "in_progress",
      "Simulated call started automatically.",
      "Waiting for the called volunteer's response in the simulator.",
    );
    break;
  }
  return unchangedOr(state, next);
}

export function completeCall(
  state: RelayState,
  callId: string,
  interpretation: Interpretation,
  provider: "amazon-bedrock" | "manual-simulator",
  transcript: string,
  nowISO: string,
): RelayState {
  clock(nowISO);
  const originalCall = state.calls.find((row) => row.id === callId);
  if (!originalCall)
    throw new Error("This call no longer exists. Refresh the call list.");
  if (["completed", "cancelled", "failed"].includes(originalCall.status))
    return state;
  if (!["in_progress", "analyzing"].includes(originalCall.status))
    throw new Error(
      "This call has not started. Wait for Relay's automatic calling workflow.",
    );
  const parsed = interpretationSchema.parse(interpretation);
  if (!transcript.trim() || transcript.length > 8000)
    throw new Error(
      "Provide a conversation transcript between 1 and 8,000 characters.",
    );
  const next = structuredClone(state);
  const call = next.calls.find((row) => row.id === callId)!;
  const shift = findShift(next, call.shiftId);
  const volunteer = findVolunteer(next, call.volunteerId);
  const invalidReason = invalidCallReason(next, call, nowISO);
  call.status = "completed";
  call.completedAt = nowISO;
  call.transcript = transcript;
  call.result = parsed;
  call.interpretationProvider = provider;
  let nextAction = "No schedule change was made.";
  const confirmedWindow =
    (!parsed.availableFrom ||
      Date.parse(parsed.availableFrom) <= Date.parse(shift.start)) &&
    (!parsed.availableUntil ||
      Date.parse(parsed.availableUntil) >= Date.parse(shift.end));
  // Confidence is an uncalibrated model signal. It can only withhold an action, never invent availability.
  const needsClarification =
    parsed.confidence < 0.8 ||
    parsed.clarification.trim().length > 0 ||
    ["uncertain", "partial", "question"].includes(parsed.outcome) ||
    (parsed.outcome === "confirmed" && !confirmedWindow);
  if (parsed.outcome === "opt_out") {
    volunteer.optedOut = true;
    volunteer.callingConsent = false;
    nextAction =
      "Calling permission withdrawn. No further calls will be made to this volunteer; attendance needs manager review.";
  }
  if (invalidReason)
    nextAction = `${invalidReason} The response was recorded without changing the schedule.`;
  else if (call.purpose === "check_in") {
    const assignment = next.assignments.find(
      (row) => row.id === call.assignmentId,
    )!;
    if (needsClarification) {
      assignment.status = "uncertain";
      assignment.note =
        parsed.clarification ||
        "Please clarify whether you can cover the entire scheduled shift.";
      nextAction = `Clarification needed: ${assignment.note} Review coverage before assigning a replacement.`;
    } else if (parsed.outcome === "confirmed") {
      assignment.status = "confirmed";
      assignment.note = parsed.summary;
      nextAction =
        "Attendance confirmed. Continue monitoring the published schedule.";
    } else if (parsed.outcome === "declined") {
      assignment.status = "cancelled";
      assignment.note = parsed.summary;
      nextAction =
        "A coverage gap needs a manager decision before any replacement outreach.";
    } else if (parsed.outcome === "late") {
      assignment.status = "late";
      assignment.note = parsed.summary;
      nextAction =
        "Late arrival may leave part of the shift uncovered. Ask for clarification and review the coverage plan.";
    } else if (parsed.outcome === "no_answer") {
      assignment.status = "uncertain";
      assignment.note = "No answer; attendance is not confirmed.";
      nextAction =
        call.attempt < next.settings.maxAttempts
          ? "Relay will retry within the configured limit and show the coverage risk to the manager."
          : "Check-in retry limit reached. Review the coverage risk; no further check-in retry is allowed.";
    } else if (parsed.outcome === "opt_out") {
      assignment.status = "uncertain";
      assignment.note =
        "Contact opt-out recorded; attendance needs manager review.";
    }
  } else {
    const incident = next.incidents.find((row) => row.id === call.incidentId)!;
    if (parsed.outcome === "confirmed" && !needsClarification) {
      // The repository saves this complete new state with one compare-and-swap, including cancellation of a disrupted assignment.
      addAssignment(next, shift, volunteer.id, nowISO, true, true);
      nextAction =
        coverage(next, shift.id).gap === 0
          ? "Replacement confirmed. Coverage is restored and further outreach is stopped."
          : "One replacement confirmed. Continue only within the remaining approved candidate list.";
    } else if (needsClarification || parsed.outcome === "late") {
      incident.status = "cancelled";
      nextAction = `Outreach stopped for manager review. ${parsed.clarification || "Please clarify full-shift availability before making an assignment."}`;
    } else
      nextAction =
        "Relay will revalidate and try the next person within the approved list and attempt limit.";
  }
  reportCall(next, call, nowISO, parsed.outcome, parsed.summary, nextAction);
  reconcile(next, nowISO);
  return next;
}
