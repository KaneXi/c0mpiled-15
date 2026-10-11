import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Relay — Volunteer coordination",
  description:
    "A manager workspace for volunteer schedules, check-ins and replacement coordination. Fictional data; simulated calls.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
