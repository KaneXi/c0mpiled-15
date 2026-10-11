import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RevenueRescue — Interactive demo",
  description:
    "Try a simpler way to follow up with customers and arrange appointments. Fictional data only.",
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
