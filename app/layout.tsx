// Server component: document shell; state and navigation are isolated client components.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Navigation from "@/components/layout/Navigation";
import { RecommendationsProvider } from "@/components/recommendations/RecommendationsProvider";
export const metadata: Metadata = {
  title: {
    default: "WolverLean · University Dining Services",
    template: "%s · WolverLean",
  },
  description:
    "University dining waste analytics. A frontend demonstration using illustrative data.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-white p-4 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to main content
        </a>
        <RecommendationsProvider>
          <Navigation />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8"
          >
            {children}
          </main>
        </RecommendationsProvider>
        <footer className="mx-auto max-w-[1280px] border-t border-slate-200 px-5 py-6 text-[13px] text-slate-600 sm:px-8">
          WolverLean · Demo calendar: October 3, 2026 · Mock analytics and AI
          insights · Decisions do not change dining production.
        </footer>
      </body>
    </html>
  );
}
