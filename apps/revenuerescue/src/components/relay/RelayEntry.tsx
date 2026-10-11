"use client";

import { useEffect, useState } from "react";
import RelayDashboard from "./RelayDashboard";
import SubscriptionPlan from "./SubscriptionPlan";

export default function RelayEntry() {
  const [plan, setPlan] = useState<boolean | null>(null);
  useEffect(() => {
    setPlan(new URLSearchParams(window.location.search).get("plan") === "1");
  }, []);
  if (plan === null) return <p role="status">Loading Relay…</p>;
  return plan ? <SubscriptionPlan /> : <RelayDashboard />;
}
