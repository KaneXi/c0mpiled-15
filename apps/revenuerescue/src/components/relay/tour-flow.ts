export type RelayTourTab = "schedule" | "volunteers" | "calls";
export const RELAY_TOUR_KEY = "relay.quick-tour.v1";

export const tourSteps: ReadonlyArray<{
  id: string;
  tab: RelayTourTab;
  target: string;
  fallback: string;
  title: string;
  description: string;
}> = [
  {
    id: "schedule",
    tab: "schedule",
    target: "shift",
    fallback: "schedule",
    title: "You make the schedule",
    description:
      "Create a draft shift, assign volunteers, then publish when it is ready. Relay only monitors published shifts. This tour will not publish anything.",
  },
  {
    id: "volunteers",
    tab: "volunteers",
    target: "volunteer",
    fallback: "volunteers",
    title: "Check availability and permission",
    description:
      "Use Edit to update phone, qualified roles and availability. Calling permission, recording permission and opt-out are separate. Open Availability & calling hours to check the details.",
  },
  {
    id: "calls",
    tab: "calls",
    target: "active-call",
    fallback: "calls",
    title: "Follow each conversation",
    description:
      "Relay starts due check-ins automatically. These phone calls are simulated: no person is called. Write the whole conversation when a call is in progress. Bedrock interprets it when enabled; an explicit manual outcome is available only when AWS AI is off.",
  },
  {
    id: "approval",
    tab: "schedule",
    target: "attention",
    fallback: "schedule",
    title: "A gap comes back to you",
    description:
      "A replacement plan lists eligible candidates in order. Yes approves that bounded outreach. No stops the plan. Assign myself opens a confirmation and checks your availability before saving.",
  },
  {
    id: "pause",
    tab: "schedule",
    target: "pause",
    fallback: "schedule",
    title: "Pause new calls whenever needed",
    description:
      "Pause AI Calls stops new calls on the server. Active calls can finish safely, and monitoring continues. Resume AI Calls lets Relay recheck the queue. The tour leaves this setting unchanged.",
  },
  {
    id: "activity",
    tab: "schedule",
    target: "activity",
    fallback: "schedule",
    title: "See what happened and what is next",
    description:
      "Recent activity records schedule changes, call outcomes and next actions. Call history keeps the conversations and identifies simulated results. Your saved workspace survives refresh. Replay this tour from Help anytime.",
  },
];

export interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function tourLayout(
  target: TourRect | null,
  viewport: { width: number; height: number },
  cardHeight: number,
) {
  const margin = 16;
  const width = Math.min(388, Math.max(0, viewport.width - margin * 2));
  const height = Math.min(
    cardHeight,
    Math.max(0, viewport.height - margin * 2),
  );
  const card = {
    left: Math.max(margin, viewport.width - width - margin),
    top: Math.max(margin, viewport.height - height - margin),
    width,
  };
  if (!target) return { card, spotlight: null };
  const left = Math.max(8, target.left - 6);
  const top = Math.max(8, target.top - 6);
  const right = Math.min(viewport.width - 8, target.left + target.width + 6);
  let bottom = Math.min(viewport.height - 8, target.top + target.height + 6);
  if (right > card.left - 12 && left < card.left + width + 12)
    bottom = Math.min(bottom, card.top - 12);
  const spotlight =
    right - left >= 12 && bottom - top >= 12
      ? { left, top, width: right - left, height: bottom - top }
      : null;
  return { card, spotlight };
}
