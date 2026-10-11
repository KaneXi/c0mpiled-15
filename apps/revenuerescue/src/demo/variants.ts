import type { DemoMode, Screen, VolunteerScreen, VoiceExample } from "../domain/demo-types";

export type WorkspaceScreen = Screen | VolunteerScreen;
export type TourStepId = "today" | "add" | "voice" | "review" | "appointments" | "results";
export interface TourStep { id: TourStepId; target: string; screen: WorkspaceScreen; title: string; text: string }
export const BUSINESS_TOUR_KEY = "revenuerescue:guest-demo:tour-completed:v1";
export const VOLUNTEER_TOUR_KEY = "revenuerescue:volunteer-demo:tour-completed:v1";
export const tourCompletionKey = (mode: DemoMode) => mode === "business" ? BUSINESS_TOUR_KEY : VOLUNTEER_TOUR_KEY;

export const businessTour: TourStep[] = [
  { id: "today", target: "today", screen: "today", title: "Start with the next customer.", text: "Today brings the inquiries that need your attention into one place. All people here are fictional. Actions during this tour do not call AWS." },
  { id: "add", target: "add", screen: "customers", title: "Keep the important details.", text: "Add a customer's name, service, and request. Contact details and permission to follow up are separate things to check." },
  { id: "voice", target: "voice", screen: "customers", title: "Check the words before acting.", text: "Choose a prepared voice example. Compare the original words with the request and notice anything that still needs confirmation." },
  { id: "review", target: "review", screen: "today", title: "You decide what gets sent.", text: "Review and edit a sample follow-up, then approve its exact wording. Sending is separate and simulated. Automatic AWS analysis appears in Operator notifications outside this tour." },
  { id: "appointments", target: "appointments", screen: "appointments", title: "Give every appointment a place.", text: "Choose a customer, stylist, and available time. The original appointment stays held until you confirm a valid replacement." },
  { id: "results", target: "results", screen: "results", title: "Record what actually happened.", text: "Track confirmed appointments and staff-reported sales. A booking is not a payment. Use Show me how to replay this tour." },
];
export const volunteerTour: TourStep[] = [
  { id: "today", target: "today", screen: "today", title: "Start with the people who can help.", text: "See registrations that need attention and shifts that need people. This is a fictional community group. Tour actions do not call AWS." },
  { id: "add", target: "add", screen: "volunteers", title: "Learn when they can join.", text: "Record a person's role interests and availability. Registration expresses interest; it does not assign a shift." },
  { id: "voice", target: "voice", screen: "volunteers", title: "Keep uncertainty visible.", text: "Try a prepared voice example. It creates an unassigned registration with unknown availability and no contact permission. Check those details before acting." },
  { id: "review", target: "shifts", screen: "shifts", title: "Confirm a place for each person.", text: "Review role, availability, and remaining places before assigning. To move someone, confirm a valid replacement first. A follow-up never assigns a shift." },
  { id: "results", target: "results", screen: "results", title: "Record the time they actually gave.", text: "Only a shift that has ended can be completed. Recorded minutes determine completed hours. Reset affects this mode only; Show me how replays this tour." },
];
export const tourSteps = (mode: DemoMode) => mode === "business" ? businessTour : volunteerTour;

export const volunteerVoiceExamples: VoiceExample[] = [
  { id: "volunteer-availability", title: "Availability to check", transcript: "I'm Casey. I'd love to help pack food boxes on Tuesday afternoon. I think I can stay for a couple of hours.", intent: "Volunteer registration; availability needs confirmation", customerName: "Casey", service: "Packing", requestedTime: "Tuesday afternoon — exact hours to confirm", uncertainty: ["Confirm the date and exact start/end times.", "Ask for contact details and permission before outreach.", "No availability window or assignment has been created."], explanation: "Interest in a role is clear. A couple of hours is not enough information to reserve a particular shift." },
  { id: "volunteer-correction", title: "A corrected request", transcript: "This is Taylor. I can welcome visitors on Monday—sorry, I mean Tuesday. Let me check whether two o'clock works.", intent: "Welcome-desk interest; corrected day and uncertain time", customerName: "Taylor", service: "Welcome", requestedTime: "Tuesday, possibly 2 PM — unconfirmed", uncertainty: ["Tuesday replaces Monday, but the time is not confirmed.", "Ask when Taylor can start and finish.", "Registration is not an assignment or permission to contact."], explanation: "Keep the speaker's correction and uncertainty. Do not turn a tentative time into confirmed availability." },
  { id: "volunteer-negation", title: "An unclear answer", transcript: "I'm Robin. I [unclear: can / can't] help with sorting on Wednesday. Could someone check back with me?", intent: "Sorting interest; participation unclear", customerName: "Robin", service: "Sorting", requestedTime: "Wednesday — attendance and hours unclear", uncertainty: ["Ask whether Robin can attend.", "Confirm exact availability and an authorized contact method.", "Leave all existing assignments unchanged."], explanation: "Can and can't lead to different decisions. The example preserves the ambiguity for a coordinator to resolve." },
];
