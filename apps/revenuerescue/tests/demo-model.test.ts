import { describe, expect, it } from "vitest";
import {
  applyAction,
  availableSlots,
  createInitialState,
  DEMO_TODAY,
  formatDate,
  formatTime,
} from "../src/demo/model";
import type { DemoAction, DemoState } from "../src/domain/demo-types";

const lena = "inquiry-lena";
const marcus = "inquiry-marcus";

function act(state: DemoState, action: DemoAction): DemoState {
  const result = applyAction(state, action);
  expect(result.error, result.message).not.toBe(true);
  return result.state;
}

function rejected(state: DemoState, action: DemoAction) {
  const snapshot = JSON.stringify(state);
  const result = applyAction(state, action);
  expect(result.error).toBe(true);
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(snapshot);
  return result;
}

describe("fictional inquiry workflow", () => {
  it("starts with independent sample state and no real customer addresses", () => {
    const first = createInitialState();
    const second = createInitialState();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.inquiries.every((item) => item.email.endsWith(".test"))).toBe(
      true,
    );
    expect(first.inquiries.some((item) => item.followUp === "SENT")).toBe(true);
  });

  it("requires the exact approved draft and never repeats a sample send", () => {
    let state = createInitialState();
    rejected(state, { type: "SEND", id: lena });
    state = act(state, { type: "DRAFT", id: lena });
    rejected(state, { type: "SEND", id: lena });
    state = act(state, { type: "APPROVE", id: lena });
    const tampered = {
      ...state,
      inquiries: state.inquiries.map((item) =>
        item.id === lena ? { ...item, draft: item.draft + " changed" } : item,
      ),
    };
    rejected(tampered, { type: "SEND", id: lena });
    state = act(state, { type: "SEND", id: lena });
    rejected(state, { type: "SEND", id: lena });
    rejected(state, { type: "DRAFT", id: lena });
    expect(state.inquiries.find((item) => item.id === lena)?.followUp).toBe(
      "SENT",
    );
  });

  it("editing removes approval, and empty text cannot be approved", () => {
    let state = createInitialState();
    state = act(state, { type: "DRAFT", id: lena });
    state = act(state, { type: "APPROVE", id: lena });
    state = act(state, { type: "EDIT_DRAFT", id: lena, text: "  " });
    expect(
      state.inquiries.find((item) => item.id === lena)?.approvedDraft,
    ).toBeNull();
    rejected(state, { type: "SEND", id: lena });
    rejected(state, { type: "APPROVE", id: lena });
  });

  it("allows local draft preparation and editing without permission but blocks approval and sending", () => {
    let state = createInitialState();
    state = act(state, { type: "DRAFT", id: "inquiry-alex" });
    expect(
      state.inquiries.find((item) => item.id === "inquiry-alex")?.followUp,
    ).toBe("DRAFT");
    state = act(state, {
      type: "EDIT_DRAFT",
      id: "inquiry-alex",
      text: "A local draft for review only.",
    });
    for (const type of ["APPROVE", "SEND"] as const)
      rejected(state, { type, id: "inquiry-alex" });
  });

  it("accepts a valid sample inquiry without inventing a booking", () => {
    const state = createInitialState();
    const input = {
      name: "  Chris Lane  ",
      email: "chris@example.test",
      service: "Haircut",
      receivedAt: "2026-10-12T09:00:00-04:00",
      notes: "Tuesday preferred",
      estimatedValue: 55,
      outcome: "OPEN" as const,
      contactPermission: true,
      source: "message" as const,
      requestedTime: "Tuesday",
    };
    const next = act(state, { type: "ADD_INQUIRY", inquiry: input });
    expect(next.inquiries[0]).toMatchObject({
      name: "Chris Lane",
      initials: "CL",
      outcome: "OPEN",
      followUp: "NONE",
    });
    expect(next.appointments).toEqual(state.appointments);
    rejected(state, {
      type: "ADD_INQUIRY",
      inquiry: { ...input, outcome: "BOOKED" },
    });
    rejected(state, {
      type: "ADD_INQUIRY",
      inquiry: { ...input, estimatedValue: Number.NaN },
    });
  });

  it("validates outcome amount, clears old revenue, and never invents a booking", () => {
    let state = createInitialState();
    rejected(state, { type: "OUTCOME", id: lena, outcome: "BOOKED" });
    for (const value of [undefined, -1, Number.NaN, 20.123])
      rejected(state, { type: "OUTCOME", id: lena, outcome: "WON", value });
    state = act(state, {
      type: "OUTCOME",
      id: lena,
      outcome: "WON",
      value: 65,
    });
    expect(
      state.inquiries.find((item) => item.id === lena)?.reportedValue,
    ).toBe(65);
    state = act(state, {
      type: "OUTCOME",
      id: lena,
      outcome: "WON",
      value: 70,
    });
    expect(
      state.inquiries.reduce(
        (total, item) => total + (item.reportedValue ?? 0),
        0,
      ),
    ).toBe(70);
    state = act(state, { type: "OUTCOME", id: lena, outcome: "LOST" });
    expect(
      state.inquiries.find((item) => item.id === lena)?.reportedValue,
    ).toBeNull();
    rejected(state, { type: "OUTCOME", id: "inquiry-jamie", outcome: "LOST" });
  });

  it("records a voice or walk-in request without inventing contact details or permission", () => {
    const state = createInitialState();
    const input = {
      name: "Voice caller",
      email: "",
      service: "Haircut",
      receivedAt: "2026-10-12T09:00:00-04:00",
      notes: "Contact details need confirmation",
      estimatedValue: 0,
      outcome: "OPEN" as const,
      contactPermission: false,
      source: "voice" as const,
    };
    let next = act(state, { type: "ADD_INQUIRY", inquiry: input });
    expect(next.inquiries[0]).toMatchObject({
      email: "",
      contactPermission: false,
      source: "voice",
    });
    next = act(next, { type: "DRAFT", id: next.inquiries[0].id });
    next = act(next, {
      type: "EDIT_DRAFT",
      id: next.inquiries[0].id,
      text: "An editable local draft without contact details.",
    });
    rejected(next, { type: "APPROVE", id: next.inquiries[0].id });
    rejected(next, { type: "SEND", id: next.inquiries[0].id });
    rejected(state, {
      type: "ADD_INQUIRY",
      inquiry: { ...input, contactPermission: true },
    });
    rejected(state, {
      type: "ADD_INQUIRY",
      inquiry: { ...input, email: "not-an-email" },
    });
  });
});

describe("shared appointment capacity", () => {
  it("returns only available sample slots and allows an existing appointment's own time", () => {
    const state = createInitialState();
    const slots = availableSlots(state, "maya", DEMO_TODAY, 60);
    expect(slots).toContain("2026-10-12T10:00:00-04:00");
    expect(slots).not.toContain("2026-10-12T10:15:00-04:00");
    expect(slots).not.toContain("2026-10-12T11:00:00-04:00");
    expect(slots).toContain("2026-10-12T12:00:00-04:00");
    expect(
      availableSlots(state, "maya", DEMO_TODAY, 60, "appointment-jamie"),
    ).toContain("2026-10-12T11:00:00-04:00");
    expect(availableSlots(state, "missing", DEMO_TODAY, 60)).toEqual([]);
    expect(availableSlots(state, "maya", "2026-10-17", 60)).toEqual([]);
    expect(availableSlots(state, "maya", DEMO_TODAY, 17)).toEqual([]);
  });

  it("rejects overlaps and accepts back-to-back or other-stylist bookings", () => {
    let state = createInitialState();
    rejected(state, {
      type: "BOOK",
      inquiryId: lena,
      resourceId: "maya",
      start: "2026-10-12T10:30:00-04:00",
      durationMinutes: 60,
    });
    state = act(state, {
      type: "BOOK",
      inquiryId: lena,
      resourceId: "maya",
      start: "2026-10-12T10:00:00-04:00",
      durationMinutes: 60,
    });
    state = act(state, {
      type: "BOOK",
      inquiryId: marcus,
      resourceId: "theo",
      start: "2026-10-12T10:00:00-04:00",
      durationMinutes: 60,
    });
    expect(
      state.appointments.filter((item) => item.status === "CONFIRMED"),
    ).toHaveLength(3);
    rejected(state, {
      type: "BOOK",
      inquiryId: lena,
      resourceId: "theo",
      start: "2026-10-12T14:00:00-04:00",
      durationMinutes: 30,
    });
  });

  it("rejects off-grid, out-of-hours, invalid-duration and timezone-free slots", () => {
    const state = createInitialState();
    for (const [start, durationMinutes] of [
      ["2026-10-12T09:10:00-04:00", 30],
      ["2026-10-12T09:00:01-04:00", 30],
      ["2026-10-12T08:45:00-04:00", 30],
      ["2026-10-12T16:45:00-04:00", 30],
      ["2026-10-12T09:00:00-04:00", 10],
      ["2026-10-12T09:00:00-04:00", 135],
      ["2026-10-12T09:00:00", 30],
      ["2026-10-12T09:00:00-04:00", 20],
    ] as const)
      rejected(state, {
        type: "BOOK",
        inquiryId: lena,
        resourceId: "theo",
        start,
        durationMinutes,
      });
  });

  it("keeps the entire original state when a reschedule cannot succeed", () => {
    let state = createInitialState();
    state = act(state, {
      type: "BOOK",
      inquiryId: lena,
      resourceId: "maya",
      start: "2026-10-13T11:00:00-04:00",
      durationMinutes: 60,
    });
    rejected(state, {
      type: "RESCHEDULE",
      appointmentId: "appointment-jamie",
      resourceId: "maya",
      start: "2026-10-13T11:00:00-04:00",
      durationMinutes: 60,
    });
    expect(
      state.appointments.find((item) => item.id === "appointment-jamie")?.start,
    ).toBe("2026-10-12T11:00:00-04:00");
  });

  it("moves one appointment atomically, freeing the old slot and occupying the new one", () => {
    const state = act(createInitialState(), {
      type: "RESCHEDULE",
      appointmentId: "appointment-jamie",
      resourceId: "maya",
      start: "2026-10-13T11:00:00-04:00",
      durationMinutes: 60,
    });
    expect(state.appointments).toHaveLength(1);
    expect(availableSlots(state, "maya", DEMO_TODAY, 60)).toContain(
      "2026-10-12T11:00:00-04:00",
    );
    expect(availableSlots(state, "maya", "2026-10-13", 60)).not.toContain(
      "2026-10-13T11:00:00-04:00",
    );
  });

  it("cancellation releases capacity and resets a booked inquiry to open", () => {
    const state = act(createInitialState(), {
      type: "CANCEL_APPOINTMENT",
      appointmentId: "appointment-jamie",
    });
    expect(
      state.inquiries.find((item) => item.id === "inquiry-jamie")?.outcome,
    ).toBe("OPEN");
    expect(availableSlots(state, "maya", DEMO_TODAY, 60)).toContain(
      "2026-10-12T11:00:00-04:00",
    );
    rejected(state, {
      type: "CANCEL_APPOINTMENT",
      appointmentId: "appointment-jamie",
    });
    expect(act(state, { type: "RESET" })).toEqual(createInitialState());
  });

  it("formats the fixed sample week in the shop timezone", () => {
    expect(formatTime("2026-10-12T15:00:00Z")).toBe("11:00 AM");
    expect(formatDate("2026-10-12T15:00:00Z")).toBe("Mon, Oct 12");
  });
});
