"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flower2,
  HelpCircle,
  Inbox,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  applyAction,
  availableSlots,
  createInitialState,
  DEMO_TODAY,
  formatDate,
  formatTime,
} from "@/demo/model";
import type {
  ActionResult,
  Appointment,
  DemoAction,
  DemoState,
  Inquiry,
  Screen,
  VoiceExample,
} from "@/domain/demo-types";
import { GuidedTour, GUEST_TOUR_COMPLETION_KEY } from "./GuidedTour";
import { VoiceExamples } from "./VoiceExamples";

const navigation = [
  { id: "today" as const, label: "Today", icon: Inbox },
  { id: "customers" as const, label: "Customers", icon: Users },
  { id: "appointments" as const, label: "Appointments", icon: CalendarDays },
  { id: "results" as const, label: "Results", icon: ArrowUpRight },
];
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
const outcomeLabel = (inquiry: Inquiry) =>
  inquiry.outcome === "WON"
    ? "Sale recorded"
    : inquiry.outcome === "LOST"
      ? "Closed"
      : inquiry.outcome === "BOOKED"
        ? "Booked"
        : inquiry.followUp === "SENT"
          ? "Followed up"
          : inquiry.followUp === "APPROVED"
            ? "Ready to send"
            : inquiry.followUp === "DRAFT"
              ? "Draft ready"
              : "Needs a reply";

export default function DemoApp() {
  const [result, dispatch] = useReducer(
    (current: ActionResult, action: DemoAction): ActionResult =>
      applyAction(current.state, action),
    undefined,
    (): ActionResult => ({ state: createInitialState(), message: "" }),
  );
  const state = result.state;
  const [screen, setScreen] = useState<Screen>("today");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInvitation, setTourInvitation] = useState(false);
  useEffect(() => {
    try {
      setTourInvitation(
        !window.localStorage.getItem(GUEST_TOUR_COMPLETION_KEY),
      );
    } catch {
      setTourInvitation(true);
    }
  }, []);
  const [resetVersion, setResetVersion] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{
    inquiryId: string;
    appointmentId?: string;
  } | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousScreen = useRef(screen);
  useEffect(() => {
    if (screen !== previousScreen.current && !tourOpen)
      headingRef.current?.focus();
    previousScreen.current = screen;
  }, [screen, tourOpen]);

  const navigate = (next: Screen) => {
    setScreen(next);
    setSearch("");
    setAdding(false);
    setScheduleTarget(null);
  };
  const openInquiry = (id: string) => {
    setSelectedId(id);
    setScheduleTarget(null);
    if (window.matchMedia("(max-width:620px)").matches && !tourOpen)
      requestAnimationFrame(() => {
        const detail = document.getElementById("inquiry-detail");
        detail?.scrollIntoView({ block: "start", behavior: "instant" });
        detail?.focus({ preventScroll: true });
      });
  };
  const openInquiries = state.inquiries.filter(
    (inquiry) => inquiry.outcome === "OPEN",
  );
  const waiting = openInquiries.filter(
    (inquiry) => inquiry.followUp !== "SENT",
  );
  const confirmed = state.appointments.filter(
    (appointment) => appointment.status === "CONFIRMED",
  );
  const selected =
    state.inquiries.find((inquiry) => inquiry.id === selectedId) ??
    waiting[0] ??
    state.inquiries[0];
  const scheduleInquiry = state.inquiries.find(
    (inquiry) => inquiry.id === scheduleTarget?.inquiryId,
  );
  const scheduleAppointment = state.appointments.find(
    (appointment) => appointment.id === scheduleTarget?.appointmentId,
  );
  const titles: Record<Screen, string> = {
    today: "A clearer day starts here.",
    customers: "A little care goes a long way.",
    appointments: "Make room for the next visit.",
    results: "See your follow-through.",
  };
  const descriptions: Record<Screen, string> = {
    today: "A few thoughtful replies. A few more reasons to come back.",
    customers: "Every request, conversation, and next step in one place.",
    appointments: "Find a time that works. Confirm it when you’re ready.",
    results: "The story behind your replies, appointments, and recorded sales.",
  };

  function addVoice(example: VoiceExample) {
    dispatch({
      type: "ADD_INQUIRY",
      inquiry: {
        name: example.customerName,
        email: "",
        service: example.service,
        receivedAt: `${DEMO_TODAY}T09:00:00-04:00`,
        notes: `${example.transcript}\n\nRequest: ${example.intent}\n${example.explanation}${example.uncertainty.length ? `\nNeeds review: ${example.uncertainty.join("; ")}` : ""}`,
        estimatedValue: 0,
        outcome: "OPEN",
        contactPermission: false,
        source: "voice",
        requestedTime: example.requestedTime || undefined,
      },
    });
    setSelectedId("");
  }

  function reset() {
    dispatch({ type: "RESET" });
    setSelectedId("");
    setScheduleTarget(null);
    setCancelId(null);
    setAdding(false);
    setShowVoice(false);
    setSearch("");
    setConfirmReset(false);
    setResetVersion((value) => value + 1);
    setScreen("today");
  }

  return (
    <div className="demo-shell">
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="RevenueRescue start">
          <span className="brand-mark">
            <Flower2 size={27} strokeWidth={1.6} />
          </span>
          <span>
            Revenue<span className="brand-light">Rescue</span>
            <span className="brand-period">.</span>
          </span>
        </a>
        <div className="shop-switch">
          <span className="shop-avatar">J</span>
          <div>
            <strong>Juniper Studio</strong>
            <span>Your sample salon</span>
          </div>
          <MoreHorizontal size={17} aria-hidden="true" />
        </div>
        <nav className="workspace-nav" aria-label="Workspace">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              aria-current={screen === item.id ? "page" : undefined}
              className={screen === item.id ? "nav-item active" : "nav-item"}
            >
              <item.icon size={20} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === "today" && waiting.length > 0 && (
                <span className="nav-count">{waiting.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Flower2 size={24} strokeWidth={1.3} />
            <p>
              Good service deserves
              <br />a good follow-up.
            </p>
          </div>
          <button className="nav-item" onClick={() => setTourOpen(true)}>
            <HelpCircle size={19} />
            <span>Show me how</span>
          </button>
          <a className="nav-item" href="/">
            <ArrowLeft size={18} />
            <span>Back to start</span>
          </a>
          <div className="guest-profile">
            <span className="guest-avatar">G</span>
            <div>
              <strong>Guest workspace</strong>
              <span>No account needed</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <div className="demo-banner">
          <div>
            <span className="status-dot" />
            <strong>Demo · Sample data</strong>
            <span className="banner-detail">
              Explore freely. No messages, calls, or payments.
            </span>
          </div>
          <button className="text-button" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} />
            Reset demo
          </button>
        </div>
        <header className="workspace-topbar">
          <span>
            Juniper Studio <ChevronRight size={14} />
            {navigation.find((item) => item.id === screen)?.label}
          </span>
          <div>
            <span className="today-date">Mon, October 12</span>
            <button className="help-button" onClick={() => setTourOpen(true)}>
              <HelpCircle size={16} />
              Show me how
            </button>
          </div>
        </header>
        {confirmReset && (
          <section
            className="reset-confirm"
            aria-label="Reset sample workspace"
          >
            <div>
              <strong>Start fresh with the original examples?</strong>
              <p>This removes your changes in this sample session.</p>
            </div>
            <button
              className="button button-soft"
              onClick={() => setConfirmReset(false)}
            >
              Keep exploring
            </button>
            <button className="button button-primary" onClick={reset}>
              Reset sample data
            </button>
          </section>
        )}

        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <h1 ref={headingRef} tabIndex={-1}>
                {titles[screen]}
              </h1>
              <p>{descriptions[screen]}</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                setScreen("customers");
                setAdding(true);
                setShowVoice(false);
              }}
            >
              <Plus size={17} />
              Add inquiry
            </button>
          </div>
          <div
            className={`feedback${result.error ? " feedback-error" : ""}${result.message ? " has-message" : ""}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {result.message && (
              <>
                {result.error ? (
                  <HelpCircle size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{result.message}</span>
              </>
            )}
          </div>

          {tourInvitation && !tourOpen && (
            <div className="tour-invitation">
              <HelpCircle size={21} />
              <div>
                <strong>A little guidance, if you need it.</strong>
                <p>Take a quick tour of your sample workspace.</p>
              </div>
              <button
                className="button button-soft"
                onClick={() => setTourOpen(true)}
              >
                Show me how <ArrowRight size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Dismiss tour invitation"
                onClick={() => {
                  setTourInvitation(false);
                  try {
                    window.localStorage.setItem(
                      GUEST_TOUR_COMPLETION_KEY,
                      "dismissed",
                    );
                  } catch {
                    /* The tour remains optional without device storage. */
                  }
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {adding && (
            <AddInquiry
              key={`add-${resetVersion}`}
              onCancel={() => setAdding(false)}
              onAdd={(inquiry) => {
                const action: DemoAction = { type: "ADD_INQUIRY", inquiry };
                const preview = applyAction(state, action);
                dispatch(action);
                if (!preview.error) {
                  setAdding(false);
                  setSelectedId(preview.state.inquiries[0]?.id ?? "");
                }
              }}
            />
          )}

          {screen === "today" && (
            <>
              <div className="section-heading" data-tour="today">
                <div>
                  <h2>
                    Your next conversations{" "}
                    <span className="count">{waiting.length}</span>
                  </h2>
                  <p>These customers are waiting for a little attention.</p>
                </div>
                <span className="quiet-label">
                  <Clock3 size={14} />
                  Ready when you are
                </span>
              </div>
              <div className="inbox-layout">
                <section
                  className="inquiry-list"
                  aria-label="Customer requests"
                >
                  {waiting.length ? (
                    waiting.map((inquiry) => (
                      <InquiryRow
                        key={inquiry.id}
                        inquiry={inquiry}
                        selected={selected?.id === inquiry.id}
                        onClick={() => openInquiry(inquiry.id)}
                      />
                    ))
                  ) : (
                    <div className="empty-state">
                      <CheckCircle2 size={31} />
                      <h3>You’re all caught up.</h3>
                      <p>
                        Your sample follow-ups are on their way. Find every
                        conversation in Customers.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => navigate("customers")}
                      >
                        View customers <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                  <div className="list-footer">
                    <span>One thoughtful reply can make a difference.</span>
                    <Flower2 size={17} />
                  </div>
                </section>
                <div data-tour="review">
                  {selected ? (
                    <InquiryDetail
                      key={`${selected.id}-${resetVersion}`}
                      inquiry={selected}
                      state={state}
                      dispatch={dispatch}
                      onSchedule={() =>
                        setScheduleTarget({
                          inquiryId: selected.id,
                          appointmentId: confirmed.find(
                            (appointment) =>
                              appointment.inquiryId === selected.id,
                          )?.id,
                        })
                      }
                    />
                  ) : (
                    <div className="empty-state">
                      Add an inquiry to try your first follow-up.
                    </div>
                  )}
                </div>
              </div>
              {scheduleInquiry && (
                <AppointmentEditor
                  key={`${scheduleInquiry.id}-${scheduleAppointment?.id ?? "new"}`}
                  state={state}
                  inquiry={scheduleInquiry}
                  appointment={scheduleAppointment}
                  dispatch={dispatch}
                  onClose={() => setScheduleTarget(null)}
                />
              )}
              <div className="today-appointments">
                <div className="section-heading">
                  <div>
                    <h2>On the appointment book</h2>
                    <p>Confirmed visits in this sample workspace.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("appointments")}
                  >
                    View appointments <ArrowRight size={16} />
                  </button>
                </div>
                {confirmed.slice(0, 3).map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    state={state}
                    onEdit={() => {
                      setScreen("appointments");
                      setScheduleTarget({
                        inquiryId: appointment.inquiryId,
                        appointmentId: appointment.id,
                      });
                    }}
                  />
                ))}
                {!confirmed.length && (
                  <p className="inline-empty">
                    No visits are confirmed yet. Choose a customer and arrange a
                    time.
                  </p>
                )}
              </div>
            </>
          )}

          {screen === "customers" && (
            <section data-tour="customers">
              <div className="customer-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <span className="sr-only">Search customers</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a name or service…"
                  />
                </label>
                <button
                  className={`button ${showVoice ? "button-dark" : "button-soft"}`}
                  onClick={() => setShowVoice((value) => !value)}
                >
                  <MessageSquare size={16} />
                  {showVoice ? "Hide voice examples" : "Try a voice example"}
                </button>
              </div>
              {showVoice && (
                <div className="voice-area" data-tour="voice">
                  <VoiceExamples key={resetVersion} onAddInquiry={addVoice} />
                </div>
              )}
              <div className="inbox-layout customers-layout">
                <section
                  className="inquiry-list"
                  aria-label="All customer inquiries"
                >
                  {state.inquiries
                    .filter((inquiry) =>
                      `${inquiry.name} ${inquiry.service}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((inquiry) => (
                      <InquiryRow
                        key={inquiry.id}
                        inquiry={inquiry}
                        selected={selected?.id === inquiry.id}
                        onClick={() => openInquiry(inquiry.id)}
                      />
                    ))}
                  {!state.inquiries.some((inquiry) =>
                    `${inquiry.name} ${inquiry.service}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ) && (
                    <div className="empty-state">
                      <Search size={26} />
                      <h3>No matching customers.</h3>
                      <p>Try a different name or service.</p>
                      <button
                        className="text-button"
                        onClick={() => setSearch("")}
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                  <div className="list-footer">
                    {state.inquiries.length} sample inquiries
                  </div>
                </section>
                <div>
                  {selected && (
                    <InquiryDetail
                      key={`${selected.id}-${resetVersion}`}
                      inquiry={selected}
                      state={state}
                      dispatch={dispatch}
                      onSchedule={() =>
                        setScheduleTarget({
                          inquiryId: selected.id,
                          appointmentId: confirmed.find(
                            (appointment) =>
                              appointment.inquiryId === selected.id,
                          )?.id,
                        })
                      }
                    />
                  )}
                </div>
              </div>
              {scheduleInquiry && (
                <AppointmentEditor
                  key={`${scheduleInquiry.id}-${scheduleAppointment?.id ?? "new"}`}
                  state={state}
                  inquiry={scheduleInquiry}
                  appointment={scheduleAppointment}
                  dispatch={dispatch}
                  onClose={() => setScheduleTarget(null)}
                />
              )}
            </section>
          )}

          {screen === "appointments" && (
            <section data-tour="appointments">
              <div className="appointment-intro">
                <CalendarDays size={23} />
                <div>
                  <strong>A requested time is a starting point.</strong>
                  <p>
                    Check your team’s availability and confirm a slot. The
                    original visit stays booked until a new time is confirmed.
                  </p>
                </div>
                <span className="quiet-label">New York time</span>
              </div>
              <div className="section-heading">
                <div>
                  <h2>
                    Confirmed appointments{" "}
                    <span className="count">{confirmed.length}</span>
                  </h2>
                  <p>Your sample week, October 12–16.</p>
                </div>
              </div>
              <div className="appointment-list">
                {confirmed.map((appointment) => (
                  <div key={appointment.id}>
                    <AppointmentRow
                      appointment={appointment}
                      state={state}
                      onEdit={() => {
                        setScheduleTarget({
                          inquiryId: appointment.inquiryId,
                          appointmentId: appointment.id,
                        });
                        setCancelId(null);
                      }}
                      onCancel={() => setCancelId(appointment.id)}
                    />
                    {cancelId === appointment.id && (
                      <div className="cancel-confirm">
                        <p>
                          Cancel this sample appointment? Its time will become
                          available.
                        </p>
                        <button
                          className="button button-soft"
                          onClick={() => setCancelId(null)}
                        >
                          Keep appointment
                        </button>
                        <button
                          className="button button-danger"
                          onClick={() => {
                            dispatch({
                              type: "CANCEL_APPOINTMENT",
                              appointmentId: appointment.id,
                            });
                            setCancelId(null);
                          }}
                        >
                          Confirm cancellation
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!confirmed.length && (
                  <div className="empty-state">
                    <CalendarDays size={30} />
                    <h3>A fresh appointment book.</h3>
                    <p>Choose a request below to arrange the first visit.</p>
                  </div>
                )}
              </div>
              {scheduleInquiry && (
                <AppointmentEditor
                  key={`${scheduleInquiry.id}-${scheduleAppointment?.id ?? "new"}`}
                  state={state}
                  inquiry={scheduleInquiry}
                  appointment={scheduleAppointment}
                  dispatch={dispatch}
                  onClose={() => setScheduleTarget(null)}
                />
              )}
              <div className="section-heading section-spaced">
                <div>
                  <h2>Ready to arrange a visit</h2>
                  <p>
                    Requests are unconfirmed until you choose and confirm a
                    time.
                  </p>
                </div>
              </div>
              <div className="request-list">
                {state.inquiries
                  .filter(
                    (inquiry) =>
                      inquiry.outcome === "OPEN" &&
                      !confirmed.some(
                        (appointment) => appointment.inquiryId === inquiry.id,
                      ),
                  )
                  .map((inquiry) => (
                    <div className="request-row" key={inquiry.id}>
                      <span className="person-avatar">{inquiry.initials}</span>
                      <div>
                        <strong>{inquiry.name}</strong>
                        <span>
                          {inquiry.service}
                          {inquiry.requestedTime
                            ? ` · Requested: ${inquiry.requestedTime}`
                            : " · No time requested yet"}
                        </span>
                      </div>
                      <button
                        className="button button-soft"
                        onClick={() =>
                          setScheduleTarget({ inquiryId: inquiry.id })
                        }
                      >
                        Arrange a time <ArrowRight size={15} />
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {screen === "results" && <Results state={state} />}
          <footer className="workspace-footer">
            <span>Made for a more thoughtful follow-up.</span>
            <span>Fictional examples · Changes reset on refresh</span>
          </footer>
        </main>
      </div>
      <GuidedTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          setTourInvitation(false);
        }}
        onNavigate={(next) => setScreen(next)}
        onStepChange={(step) => {
          if (step === "voice") setShowVoice(true);
          if (step === "add") setAdding(true);
          else setAdding(false);
        }}
      />
    </div>
  );
}

function InquiryRow({
  inquiry,
  selected,
  onClick,
}: {
  inquiry: Inquiry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inquiry-row${selected ? " selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span
        className={`person-avatar avatar-${inquiry.initials.charCodeAt(0) % 3}`}
      >
        {inquiry.initials}
      </span>
      <span className="inquiry-row-body">
        <span className="row-first">
          <strong>{inquiry.name}</strong>
          <span>
            {inquiry.source === "voice" ? (
              <MessageSquare size={14} aria-label="Voice example" />
            ) : (
              <Mail size={14} aria-label="Message inquiry" />
            )}
          </span>
        </span>
        <span className="inquiry-service">{inquiry.service}</span>
        <span
          className={`status-label status-${inquiry.outcome !== "OPEN" ? "done" : inquiry.followUp.toLowerCase()}`}
        >
          <span />
          {outcomeLabel(inquiry)}
        </span>
      </span>
      <ChevronRight size={16} className="row-chevron" />
    </button>
  );
}

function InquiryDetail({
  inquiry,
  state,
  dispatch,
  onSchedule,
}: {
  inquiry: Inquiry;
  state: DemoState;
  dispatch: (action: DemoAction) => void;
  onSchedule: () => void;
}) {
  const [showOutcome, setShowOutcome] = useState(false);
  const [saleValue, setSaleValue] = useState(
    String(inquiry.estimatedValue || ""),
  );
  const appointment = state.appointments.find(
    (item) => item.inquiryId === inquiry.id && item.status === "CONFIRMED",
  );
  const sent = inquiry.followUp === "SENT";
  return (
    <article
      className="inquiry-detail"
      id="inquiry-detail"
      tabIndex={-1}
      aria-label={`Inquiry from ${inquiry.name}`}
    >
      <header className="detail-header">
        <div className="detail-person">
          <span className="person-avatar large-avatar">{inquiry.initials}</span>
          <div>
            <h2>{inquiry.name}</h2>
            <p>{inquiry.service}</p>
          </div>
        </div>
        <span className="quiet-label">
          {inquiry.source === "voice" ? "Voice example" : "Sample inquiry"}
        </span>
      </header>
      <div className="customer-message">
        <div className="message-label">
          <MessageSquare size={15} />
          What they asked
        </div>
        <p>{inquiry.notes}</p>
        {inquiry.requestedTime && (
          <div className="requested-time">
            <Clock3 size={14} />
            Requested: {inquiry.requestedTime}
            <span>Not confirmed</span>
          </div>
        )}
      </div>
      <div className="detail-section">
        <div className="detail-section-heading">
          <h3>A thoughtful next step</h3>
          <span className="sample-badge">
            <Sparkles size={12} />
            Sample draft
          </span>
        </div>
        {!inquiry.draft ? (
          <div className="draft-empty">
            <p>
              Start with a short, friendly reply based on this request. You can
              edit every word.
            </p>
            <button
              className="button button-dark"
              disabled={inquiry.outcome !== "OPEN"}
              onClick={() => dispatch({ type: "DRAFT", id: inquiry.id })}
            >
              <Sparkles size={16} />
              Prepare a draft
            </button>
            <span>
              {!inquiry.contactPermission || !inquiry.email
                ? "You can review a sample draft. Contact details and permission are needed before approval or sending."
                : inquiry.outcome !== "OPEN"
                  ? "This inquiry already has an outcome. No follow-up is needed."
                  : "Uses a local sample template. No AI service is called."}
            </span>
          </div>
        ) : (
          <>
            <div className="recipient-line">
              <span>To</span>
              <strong>{inquiry.email || "Contact details needed"}</strong>
              {inquiry.contactPermission ? (
                <span className="permission-ok">
                  <Check size={12} />
                  Permission recorded
                </span>
              ) : (
                <span className="permission-needed">No contact permission</span>
              )}
            </div>
            <label className="draft-label">
              <span className="sr-only">
                Follow-up message for {inquiry.name}
              </span>
              <textarea
                rows={6}
                value={inquiry.draft}
                disabled={sent || inquiry.outcome !== "OPEN"}
                onChange={(event) =>
                  dispatch({
                    type: "EDIT_DRAFT",
                    id: inquiry.id,
                    text: event.target.value,
                  })
                }
              />
            </label>
            {!inquiry.contactPermission && (
              <p className="inline-warning">
                This example has no permission to contact. You can review it and
                arrange a sample visit, but sending is blocked.
              </p>
            )}
            {sent || inquiry.outcome !== "OPEN" ? (
              <div className="sent-confirmation">
                <CheckCircle2 size={19} />
                <div>
                  <strong>
                    {sent ? "Sample follow-up complete" : outcomeLabel(inquiry)}
                  </strong>
                  <p>
                    {sent
                      ? "No real message was sent. Your next step is to record what happens."
                      : "This inquiry already has an outcome. Draft editing and follow-up are paused."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="draft-actions">
                <div>
                  <span
                    className={`approval-status${inquiry.followUp === "APPROVED" ? " approved" : ""}`}
                  >
                    <span />
                    {inquiry.followUp === "APPROVED"
                      ? "Draft approved"
                      : "Your review comes first"}
                  </span>
                  <small>
                    {inquiry.followUp === "APPROVED"
                      ? "Editing the draft will require approval again."
                      : "Approval and sending are separate steps."}
                  </small>
                </div>
                <button
                  className={`button ${inquiry.followUp === "APPROVED" ? "button-primary" : "button-dark"}`}
                  disabled={
                    !inquiry.draft.trim() ||
                    !inquiry.contactPermission ||
                    !inquiry.email
                  }
                  onClick={() =>
                    dispatch({
                      type:
                        inquiry.followUp === "APPROVED" ? "SEND" : "APPROVE",
                      id: inquiry.id,
                    })
                  }
                >
                  {inquiry.followUp === "APPROVED" ? (
                    <>
                      <Send size={16} />
                      Simulate sending
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Approve draft
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div className="detail-next-step">
        <div>
          <CalendarDays size={19} />
          <div>
            <strong>
              {appointment
                ? "A visit is on the calendar"
                : "A visit worth making time for"}
            </strong>
            <p>
              {appointment
                ? `${formatDate(appointment.start)} at ${formatTime(appointment.start)}`
                : "Choose a time with your team before confirming."}
            </p>
          </div>
        </div>
        <button
          className="text-button"
          disabled={
            !appointment &&
            (inquiry.outcome === "LOST" || inquiry.outcome === "WON")
          }
          onClick={onSchedule}
        >
          {appointment ? "Change time" : "Arrange a visit"}
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="detail-outcome">
        <button
          className="text-button"
          onClick={() => setShowOutcome((value) => !value)}
          aria-expanded={showOutcome}
        >
          {showOutcome ? "Hide outcome options" : "Record an outcome"}
          <ChevronRight size={14} />
        </button>
        <span>{outcomeLabel(inquiry)}</span>
      </div>
      {showOutcome && (
        <div className="outcome-form">
          <p>
            Record what your shop knows. A reported sale is not a verified
            payment.
          </p>
          <label>
            Reported sale value <span>(USD)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={saleValue}
              onChange={(event) => setSaleValue(event.target.value)}
            />
          </label>
          <div className="button-row">
            <button
              className="button button-soft"
              disabled={
                saleValue.trim() === "" ||
                !Number.isFinite(Number(saleValue)) ||
                Number(saleValue) < 0
              }
              onClick={() =>
                dispatch({
                  type: "OUTCOME",
                  id: inquiry.id,
                  outcome: "WON",
                  value: Number(saleValue),
                })
              }
            >
              Record sample sale
            </button>
            <button
              className="text-button"
              onClick={() =>
                dispatch({ type: "OUTCOME", id: inquiry.id, outcome: "LOST" })
              }
            >
              Close without sale
            </button>
          </div>
          {appointment && (
            <p className="form-help">
              A confirmed appointment must be canceled before closing without a
              sale.
            </p>
          )}
        </div>
      )}
      <div className="detail-last-action">
        <Clock3 size={13} />
        <span>{inquiry.lastAction}</span>
      </div>
    </article>
  );
}

type NewInquiry = Extract<DemoAction, { type: "ADD_INQUIRY" }>["inquiry"];
function AddInquiry({
  onAdd,
  onCancel,
}: {
  onAdd: (inquiry: NewInquiry) => void;
  onCancel: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onAdd({
      name: String(data.get("name")).trim(),
      email: String(data.get("email")).trim(),
      service: String(data.get("service")).trim(),
      notes: String(data.get("notes")).trim(),
      estimatedValue: Number(data.get("value") || 0),
      receivedAt: `${DEMO_TODAY}T09:00:00-04:00`,
      contactPermission: data.get("permission") === "on",
      outcome: "OPEN",
      source: "message",
    });
  }
  return (
    <section
      className="add-inquiry-panel"
      data-tour="add"
      aria-labelledby="add-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="add-heading">Add a sample inquiry</h2>
          <p>Use fictional details. This workspace clears when you refresh.</p>
        </div>
        <button
          className="icon-button"
          onClick={onCancel}
          aria-label="Close add inquiry"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Customer name
            <input
              name="name"
              required
              maxLength={80}
              placeholder="e.g. Jordan Lee"
              autoFocus
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              placeholder="jordan@example.test"
            />
          </label>
          <label>
            Service requested
            <input
              name="service"
              required
              maxLength={120}
              placeholder="e.g. Cut & finish"
            />
          </label>
          <label>
            Estimated value <span>(USD, optional)</span>
            <input
              name="value"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              placeholder="0.00"
            />
          </label>
          <label className="full-width">
            What did they ask?
            <textarea
              name="notes"
              rows={3}
              required
              maxLength={2000}
              placeholder="A few details to help with the next reply…"
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input type="checkbox" name="permission" />
          <span>
            This fictional customer has agreed to receive a follow-up.
          </span>
        </label>
        <div className="button-row">
          <button className="button button-primary" type="submit">
            <Plus size={16} />
            Add sample inquiry
          </button>
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function AppointmentRow({
  appointment,
  state,
  onEdit,
  onCancel,
}: {
  appointment: Appointment;
  state: DemoState;
  onEdit: () => void;
  onCancel?: () => void;
}) {
  const inquiry = state.inquiries.find(
    (item) => item.id === appointment.inquiryId,
  );
  const resource = state.resources.find(
    (item) => item.id === appointment.resourceId,
  );
  return (
    <div className="appointment-row">
      <div className="appointment-time">
        <strong>{formatTime(appointment.start)}</strong>
        <span>{formatDate(appointment.start)}</span>
      </div>
      <div className="appointment-person">
        <strong>{inquiry?.name ?? "Sample customer"}</strong>
        <span>
          {inquiry?.service} · {appointment.durationMinutes} min with{" "}
          {resource?.name}
        </span>
        {inquiry?.requestedTime && (
          <small className="reschedule-request">
            <Clock3 size={11} />
            New time requested: {inquiry.requestedTime}
          </small>
        )}
      </div>
      <span className="confirmed-label">
        <CheckCircle2 size={14} />
        Confirmed
      </span>
      <div className="appointment-actions">
        <button className="text-button" onClick={onEdit}>
          Change time
          <ArrowRight size={14} />
        </button>
        {onCancel && (
          <button className="text-button muted-button" onClick={onCancel}>
            Cancel visit
          </button>
        )}
      </div>
    </div>
  );
}

function AppointmentEditor({
  state,
  inquiry,
  appointment,
  dispatch,
  onClose,
}: {
  state: DemoState;
  inquiry: Inquiry;
  appointment?: Appointment;
  dispatch: (action: DemoAction) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(
    appointment?.start.slice(0, 10) ?? DEMO_TODAY,
  );
  const [resourceId, setResourceId] = useState(
    appointment?.resourceId ?? state.resources[0]?.id ?? "",
  );
  const [duration, setDuration] = useState(appointment?.durationMinutes ?? 60);
  const [start, setStart] = useState("");
  const available = availableSlots(
    state,
    resourceId,
    date,
    duration,
    appointment?.id,
  );
  const choiceValid = available.some(
    (slot) => new Date(slot).getTime() === new Date(start).getTime(),
  );
  const choices = Array.from(
    { length: 16 },
    (_, index) =>
      `${date}T${String(9 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}:00-04:00`,
  );
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    editorRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "instant",
    });
    editorRef.current?.focus({ preventScroll: true });
  }, []);
  const resourceName = state.resources.find(
    (item) => item.id === resourceId,
  )?.name;
  return (
    <section
      ref={editorRef}
      tabIndex={-1}
      className="appointment-editor"
      aria-labelledby="schedule-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="schedule-title">
            {appointment ? "Find a new time" : "Arrange a visit"} for{" "}
            {inquiry.name}
          </h2>
          <p>
            {appointment
              ? "The current appointment stays in place until you confirm a replacement."
              : "Select an available time, then confirm the sample appointment."}
          </p>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close appointment editor"
        >
          <X size={20} />
        </button>
      </div>
      {appointment && (
        <div className="original-appointment">
          <CheckCircle2 size={17} />
          <span>
            Currently confirmed:{" "}
            <strong>
              {formatDate(appointment.start)}, {formatTime(appointment.start)}
            </strong>{" "}
            with{" "}
            {
              state.resources.find((item) => item.id === appointment.resourceId)
                ?.name
            }
          </span>
        </div>
      )}
      {inquiry.requestedTime && (
        <p className="form-help">
          Customer requested: <strong>{inquiry.requestedTime}</strong>. A
          request does not reserve a time.
        </p>
      )}
      <div className="schedule-controls">
        <label>
          Day
          <select
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setStart("");
            }}
          >
            {[12, 13, 14, 15, 16].map((day) => (
              <option key={day} value={`2026-10-${day}`}>
                {formatDate(`2026-10-${day}T12:00:00-04:00`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team member
          <select
            value={resourceId}
            onChange={(event) => {
              setResourceId(event.target.value);
              setStart("");
            }}
          >
            {state.resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name} · {resource.role}
              </option>
            ))}
          </select>
        </label>
        <label>
          Visit length
          <select
            value={duration}
            onChange={(event) => {
              setDuration(Number(event.target.value));
              setStart("");
            }}
          >
            {[30, 45, 60, 90, 120].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="slot-heading">
        <h3>Choose a time</h3>
        <span>
          New York time · Occupied or too late to finish slots are unavailable
        </span>
      </div>
      <div
        className="slot-grid"
        role="group"
        aria-label="Appointment start times"
      >
        {choices.map((slot) => {
          const isAvailable = available.some(
            (candidate) =>
              new Date(candidate).getTime() === new Date(slot).getTime(),
          );
          return (
            <button
              key={slot}
              className={`slot-button${start === slot ? " selected" : ""}`}
              disabled={!isAvailable}
              aria-pressed={start === slot}
              onClick={() => setStart(slot)}
            >
              {formatTime(slot)}
              {!isAvailable ? (
                <span>Unavailable</span>
              ) : start === slot ? (
                <Check size={13} />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="schedule-confirm">
        <div>
          <strong>
            {start && choiceValid
              ? `${formatDate(start)} at ${formatTime(start)}`
              : "Choose a time to continue"}
          </strong>
          <p>
            {start && choiceValid
              ? `${duration} minutes with ${resourceName}. No customer will be contacted.`
              : "Unavailable times cannot be booked. Your current records are unchanged."}
          </p>
        </div>
        <button
          className="button button-primary"
          disabled={!choiceValid}
          onClick={() => {
            const action: DemoAction = appointment
              ? {
                  type: "RESCHEDULE",
                  appointmentId: appointment.id,
                  resourceId,
                  start,
                  durationMinutes: duration,
                }
              : {
                  type: "BOOK",
                  inquiryId: inquiry.id,
                  resourceId,
                  start,
                  durationMinutes: duration,
                };
            const preview = applyAction(state, action);
            dispatch(action);
            if (!preview.error) onClose();
          }}
        >
          <Check size={17} />
          {appointment ? "Confirm new time" : "Confirm appointment"}
        </button>
      </div>
    </section>
  );
}

function Results({ state }: { state: DemoState }) {
  const sent = state.inquiries.filter(
    (inquiry) => inquiry.followUp === "SENT",
  ).length;
  const booked = state.appointments.filter(
    (appointment) => appointment.status === "CONFIRMED",
  ).length;
  const won = state.inquiries.filter((inquiry) => inquiry.outcome === "WON");
  const reported = won.reduce(
    (sum, inquiry) => sum + (inquiry.reportedValue ?? 0),
    0,
  );
  return (
    <section data-tour="results">
      <div className="results-summary">
        <div className="results-intro">
          <Flower2 size={35} strokeWidth={1.2} />
          <h2>
            Small follow-ups.
            <br />
            Meaningful next steps.
          </h2>
          <p>These results come from your actions in this sample workspace.</p>
        </div>
        <dl className="results-ledger">
          <div>
            <dt>
              <Mail size={18} />
              <span>
                Sample follow-ups sent<small>No real messages</small>
              </span>
            </dt>
            <dd>{sent}</dd>
          </div>
          <div>
            <dt>
              <CalendarDays size={18} />
              <span>
                Confirmed appointments<small>Not customer requests</small>
              </span>
            </dt>
            <dd>{booked}</dd>
          </div>
          <div>
            <dt>
              <CheckCircle2 size={18} />
              <span>
                Sales recorded by staff
                <small>
                  {won.length} sample {won.length === 1 ? "sale" : "sales"} ·
                  Not verified payments
                </small>
              </span>
            </dt>
            <dd>{money(reported)}</dd>
          </div>
        </dl>
      </div>
      <div className="section-heading section-spaced">
        <div>
          <h2>The latest activity</h2>
          <p>A clear record of what happened, and what you chose.</p>
        </div>
      </div>
      <ol className="activity-list">
        {state.activity.slice(0, 14).map((activity) => (
          <li key={activity.id}>
            <span className="activity-icon">
              <ArrowDownLeft size={15} />
            </span>
            <div>
              <p>{activity.text}</p>
              <span>
                {formatDate(activity.at)} · {formatTime(activity.at)}
              </span>
            </div>
            <span className="sample-tag">Sample</span>
          </li>
        ))}
      </ol>
      {!state.activity.length && (
        <div className="empty-state">
          <h3>Your next step starts the story.</h3>
          <p>
            Prepare a draft or confirm an appointment to see it recorded here.
          </p>
        </div>
      )}
      <p className="results-note">
        Estimated inquiry values, booked visits, and staff-reported sales are
        different measures. This demo does not collect or verify payments.
      </p>
    </section>
  );
}
