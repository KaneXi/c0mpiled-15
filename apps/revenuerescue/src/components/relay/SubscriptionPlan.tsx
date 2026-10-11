"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Copy } from "lucide-react";
import s from "./Relay.module.css";

export function SubscriptionLink() {
  return (
    <a className={s.textButton} href="/?plan=1">
      First month free · then $4.99/month <ArrowRight size={16} />
    </a>
  );
}

export default function SubscriptionPlan() {
  const [message, setMessage] = useState("");
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?plan=1`);
      setMessage("Plan link copied. Share it with your sponsor.");
    } catch {
      setMessage(
        "Copy this page's address to share the plan with your sponsor.",
      );
    }
  }
  return (
    <main className={s.subscriptionPage}>
      <header className={s.subscriptionHeader}>
        <a className={s.brand} href="/" aria-label="Relay workspace">
          Relay<span>.</span>
        </a>
        <a className={s.textButton} href="/">
          <ArrowLeft size={16} /> Back to workspace
        </a>
      </header>
      <section className={s.subscriptionOffer} aria-labelledby="plan-title">
        <h1 id="plan-title">A little help for every shift.</h1>
        <p className={s.subscriptionIntro}>
          Keep volunteer schedules, availability checks and replacement
          follow-up together in one place.
        </p>
        <div className={s.subscriptionPrice}>
          <strong>$0</strong>
          <span>for your first month</span>
        </div>
        <p className={s.subscriptionRenewal}>Then $4.99 / month</p>
        <dl className={s.subscriptionTerms}>
          <div>
            <dt>First month</dt>
            <dd>Free</dd>
          </div>
          <div>
            <dt>From month two</dt>
            <dd>$4.99 USD per month</dd>
          </div>
          <div>
            <dt>First charge</dt>
            <dd>One month after activation</dd>
          </div>
        </dl>
        <p>
          Review the recurring subscription terms at checkout before confirming.
          Opening this page does not start a trial or a payment.
        </p>
        <button
          className={s.primary}
          type="button"
          disabled
          aria-describedby="checkout-status"
        >
          Continue to payment <ArrowRight size={17} />
        </button>
        <p id="checkout-status" className={s.subscriptionNotice} role="status">
          Checkout is not connected yet. No subscription or payment can be
          completed here at this time.
        </p>
      </section>
      <section
        className={s.subscriptionSponsor}
        aria-labelledby="sponsor-title"
      >
        <h2 id="sponsor-title">For our first sponsor</h2>
        <p>
          Use this same plan page to review the offer. A free-trial enrollment
          is separate from the first paid invoice; only a payment-provider
          receipt will confirm a payment.
        </p>
        <button
          className={s.secondary}
          type="button"
          onClick={() => void copyLink()}
        >
          <Copy size={16} /> Copy sponsor link
        </button>
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
