import type { RelayState, Volunteer } from "./contracts";

/** Fictional records only. Nothing is published and no call starts from a seed. */
export function createRelayState(tenantId: string, nowISO: string): RelayState {
  const now = Date.parse(nowISO);
  if (!tenantId || !Number.isFinite(now)) throw new Error("A tenant and valid current time are required.");
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
  const person = (id: string, name: string, phone: string, preferredRoles = ["meal-packing"]): Volunteer => ({
    id, name, phone, roles: ["meal-packing", "welcome"], preferredRoles,
    availability: [{ start: at(-240), end: at(1440) }],
    callingConsent: true, recordingConsent: false, optedOut: false, active: true,
    timezone: "America/New_York", quietHours: { start: 22, end: 8 },
  });
  return {
    schemaVersion: 1, tenantId, revision: 0, organization: "Community Table", managerVolunteerId: "vol-manager",
    volunteers: [
      person("vol-manager", "Casey Morris", "+12025550100"),
      person("vol-taylor", "Taylor Reed", "+12025550101"),
      person("vol-avery", "Avery Lopez", "+12025550102"),
      person("vol-samira", "Samira Khan", "+12025550103"),
      person("vol-riley", "Riley Chen", "+12025550104", ["welcome"]),
    ],
    shifts: [
      { id: "shift-meals", title: "Community meal packing", role: "meal-packing", start: at(45), end: at(165), required: 1, status: "draft", version: 1 },
      { id: "shift-welcome", title: "Welcome desk", role: "welcome", start: at(240), end: at(300), required: 1, status: "draft", version: 1 },
    ],
    assignments: [
      { id: "assignment-taylor", shiftId: "shift-meals", volunteerId: "vol-taylor", status: "assigned", note: "Draft assignment; publish the schedule to enable automatic check-ins." },
      { id: "assignment-riley", shiftId: "shift-welcome", volunteerId: "vol-riley", status: "assigned", note: "Draft assignment." },
    ],
    calls: [], incidents: [], paused: false,
    settings: { checkInLeadMinutes: 120, maxAttempts: 3, retryMinutes: 5 },
    activity: [{ id: "activity-1", at: new Date(now).toISOString(), kind: "system", text: "Fictional workspace ready. Review and publish a draft schedule to enable automatic simulated check-ins.", nextAction: "Review the draft schedule." }],
  };
}
