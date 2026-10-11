import type { RelayState, Volunteer } from "./contracts";

/** Fictional records only. Nothing is published and no call starts from a seed. */
export function createRelayState(tenantId: string, nowISO: string): RelayState {
  const now = Date.parse(nowISO);
  if (!tenantId || !Number.isFinite(now))
    throw new Error("A tenant and valid current time are required.");
  const at = (minutes: number) =>
    new Date(now + minutes * 60_000).toISOString();
  const person = (
    id: string,
    name: string,
    phone: string,
    preferredRoles = ["meal-packing"],
  ): Volunteer => ({
    id,
    name,
    phone,
    roles: ["meal-packing", "welcome"],
    preferredRoles,
    availability: [{ start: at(-240), end: at(1440) }],
    callingConsent: true,
    recordingConsent: false,
    optedOut: false,
    active: true,
    timezone: "America/New_York",
    quietHours: { start: 22, end: 8 },
  });
  return {
    schemaVersion: 1,
    tenantId,
    revision: 0,
    organization: "Community Table",
    managerVolunteerId: "vol-manager",
    volunteers: [
      person("vol-manager", "Casey Morris", "+12025550100"),
      person("vol-taylor", "Taylor Reed", "+12025550101"),
      person("vol-avery", "Avery Lopez", "+12025550102"),
      person("vol-samira", "Samira Khan", "+12025550103"),
      person("vol-riley", "Riley Chen", "+12025550104", ["welcome"]),
    ],
    shifts: [
      {
        id: "shift-meals",
        title: "Community meal packing",
        role: "meal-packing",
        start: at(45),
        end: at(165),
        required: 1,
        status: "draft",
        version: 1,
      },
      {
        id: "shift-welcome",
        title: "Welcome desk",
        role: "welcome",
        start: at(240),
        end: at(300),
        required: 1,
        status: "draft",
        version: 1,
      },
    ],
    assignments: [
      {
        id: "assignment-taylor",
        shiftId: "shift-meals",
        volunteerId: "vol-taylor",
        status: "assigned",
        note: "Draft assignment; publish the schedule to enable automatic check-ins.",
      },
      {
        id: "assignment-riley",
        shiftId: "shift-welcome",
        volunteerId: "vol-riley",
        status: "assigned",
        note: "Draft assignment.",
      },
    ],
    calls: [],
    incidents: [],
    paused: false,
    settings: { checkInLeadMinutes: 120, maxAttempts: 3, retryMinutes: 5 },
    activity: [
      {
        id: "activity-1",
        at: new Date(now).toISOString(),
        kind: "system",
        text: "Fictional workspace ready. Review and publish a draft schedule to enable automatic simulated check-ins.",
        nextAction: "Review the draft schedule.",
      },
    ],
  };
}

/** Four fictional test participants plus a manager; explicit reset only. */
export function createSampleSchedule(
  tenantId: string,
  nowISO: string,
): RelayState {
  const state = createRelayState(tenantId, nowISO);
  const quarter = 15 * 60_000;
  const start =
    Math.ceil((Date.parse(nowISO) + 45 * 60_000) / quarter) * quarter;
  const at = (minutes: number) =>
    new Date(start + minutes * 60_000).toISOString();
  state.organization = "Community Table · Four-person sample";
  state.paused = true;
  state.volunteers = state.volunteers.map((person) => ({
    ...person,
    name: person.id === "vol-taylor" ? "Kane (sample)" : person.name,
    roles:
      person.id === "vol-taylor"
        ? ["meal-packing", "welcome", "supply-lead"]
        : person.roles,
    availability: [{ start: at(-30), end: at(180) }],
  }));
  state.shifts = [
    {
      id: "shift-sample-meals",
      title: "Sample · Meal packing",
      role: "meal-packing",
      start: at(0),
      end: at(60),
      required: 1,
      status: "draft",
      version: 1,
    },
    {
      id: "shift-sample-welcome",
      title: "Sample · Welcome desk (conflict)",
      role: "welcome",
      start: at(-15),
      end: at(75),
      required: 1,
      status: "draft",
      version: 1,
    },
    {
      id: "shift-sample-supplies",
      title: "Sample · Supply lead (no replacement)",
      role: "supply-lead",
      start: at(60),
      end: at(90),
      required: 1,
      status: "draft",
      version: 1,
    },
  ];
  state.assignments = [
    {
      id: "sample-original",
      shiftId: "shift-sample-meals",
      volunteerId: "vol-taylor",
      status: "assigned",
      note: "Fictional sample: original assignee. Publish this shift first.",
    },
    {
      id: "sample-conflict",
      shiftId: "shift-sample-welcome",
      volunteerId: "vol-riley",
      status: "assigned",
      note: "Keep this draft assignment to test overlap exclusion. Do not publish it during the main demonstration.",
    },
    {
      id: "sample-no-replacement",
      shiftId: "shift-sample-supplies",
      volunteerId: "vol-taylor",
      status: "assigned",
      note: "Only this volunteer has the supply-lead role. Publish separately to test an uncovered shift.",
    },
  ];
  state.activity = [
    {
      id: "sample-ready",
      at: nowISO,
      kind: "system",
      text: "Four-person fictional sample loaded with future draft shifts and calls paused. All numbers and permissions are test fixtures, not real contact authorization.",
      nextAction:
        "Publish Sample · Meal packing, then Resume AI Calls. Leave the other shifts as drafts.",
    },
  ];
  return state;
}
