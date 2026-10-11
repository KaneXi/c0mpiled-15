import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RevenueRescue — Your next step",
  description:
    "An AWS-powered assistant for customer requests and volunteer coordination. Explore with fictional guest data.",
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
