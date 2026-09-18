import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iconic Bullion Prototype",
  description: "High-fidelity customer-facing bullion website prototype.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
