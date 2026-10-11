import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  MessageCircle,
  Play,
} from "lucide-react";
import styles from "./welcome.module.css";
export default function Welcome() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="RevenueRescue home">
          <span className={styles.brandMark}>
            <MessageCircle size={21} strokeWidth={2} />
          </span>
          RevenueRescue<span className={styles.brandDot}>.</span>
        </Link>
        <span className={styles.demoLabel}>Business + Volunteers</span>
      </header>
      <section className={styles.hero} aria-labelledby="welcome-heading">
        <div className={styles.intro}>
          <h1 id="welcome-heading">
            Good conversations.
            <br />
            <span>One clear next step.</span>
          </h1>
          <p className={styles.description}>
            A new request comes in. Your AWS assistant checks the sample
            schedule and brings you a clear next step.
          </p>
          <Link href="/demo" className={styles.cta}>
            Try the demo <ArrowRight size={21} />
          </Link>
          <p className={styles.finePrint}>
            No account needed. Explore a sample shop or volunteer team.
          </p>
          <div className={styles.footnote}>
            <Play size={16} fill="currentColor" />
            <span>Start with a short guided tour, or explore on your own.</span>
          </div>
        </div>
        <div
          className={styles.preview}
          aria-label="Preview with fictional customer data"
        >
          <div className={styles.previewHeader}>
            <div>
              <strong>Juniper Studio</strong>
              <span>A neighborhood salon</span>
            </div>
            <span className={styles.sample}>Sample shop</span>
          </div>
          <div className={styles.previewBody}>
            <div className={styles.requestHeader}>
              <span className={styles.avatar}>JL</span>
              <div>
                <strong>Jordan Lee</strong>
                <span>Appointment request</span>
              </div>
              <span className={styles.time}>Just now</span>
            </div>
            <blockquote>
              “I can’t make Monday. Could we move my appointment to Tuesday at
              two?”
            </blockquote>
            <div className={styles.connector}>
              <span />
              <ArrowRight size={17} />
              <span />
            </div>
            <div className={styles.appointment}>
              <CalendarDays size={24} />
              <div>
                <strong>Tuesday, October 13</strong>
                <span>2:00 PM · Haircut with Maya</span>
              </div>
              <span className={styles.review}>Needs review</span>
            </div>
            <div className={styles.confirmNote}>
              <Check size={18} />
              <span>You check the details. You make the call.</span>
            </div>
          </div>
          <div className={styles.previewFooter}>
            <span>See how a request becomes a plan.</span>
            <ArrowUpRight size={19} />
          </div>
        </div>
      </section>
      <section className={styles.learn} aria-label="What you can try">
        <p>A small workspace for the work that matters.</p>
        <div>
          <span>
            <MessageCircle size={18} /> Understand each request
          </span>
          <span>
            <CalendarDays size={18} /> Arrange a new time
          </span>
          <span>
            <Check size={18} /> Coordinate volunteers
          </span>
        </div>
      </section>
      <footer className={styles.footer}>
        <span>Built for a busy front desk.</span>
        <span>
          Fictional records. Real analysis online. No external messages or
          payments.
        </span>
      </footer>
    </main>
  );
}
