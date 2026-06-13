import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { SosButton } from "@/components/SosButton";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";

// Humanist, warm, highly legible — reads friendly rather than clinical.
const fontSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MindLog — a quiet companion for exam season",
  description:
    "Journal freely, notice your patterns, and get gentle, personalized support through high-stakes exam prep. A supportive companion — not a clinical service.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f4ee",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontSans.variable}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--paper)]/85 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
            <a
              href="/"
              className="flex items-baseline gap-2 rounded-lg"
              aria-label="MindLog home"
            >
              <span className="text-lg font-extrabold tracking-tight text-ink">
                Mind<span className="text-sage-500">Log</span>
              </span>
              <span className="hidden text-xs font-semibold text-ink/70 sm:inline">
                a quiet companion
              </span>
            </a>
            <SosButton />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
          {children}
        </main>

        <DisclaimerFooter />
      </body>
    </html>
  );
}
