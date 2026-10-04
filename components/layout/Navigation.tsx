"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRecommendations } from "@/components/recommendations/RecommendationsProvider";
import ThemeControls from "@/components/accessibility/ThemeProvider";
const links = [
  ["/", "Home"],
  ["/food", "Food Data"],
  ["/finances", "Finances"],
  ["/recommendations", "AI Recommendations"],
];
export default function Navigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { pending, ready } = useRecommendations();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center text-xl font-bold tracking-tight text-navy"
          aria-label="WolverLean home"
        >
          Wolver<span className="text-emerald-700">Lean</span>
          <span className="ml-3 rounded bg-amber-50 px-2 py-1 text-[13px] font-semibold uppercase tracking-widest text-amber-900">
            Demo
          </span>
        </Link>
        <span className="hidden text-[13px] font-medium text-slate-600 sm:block">
          University Dining Services
        </span>
        <button
          className="btn md:hidden"
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close menu" : "Menu"} <span aria-hidden="true">☰</span>
        </button>
        <ThemeControls />
        <nav
          id="primary-nav"
          aria-label="Primary navigation"
          className={`${open ? "flex" : "hidden"} w-full flex-col gap-1 md:flex md:w-auto md:flex-row`}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${path === href ? "bg-navy text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {label}
              {href === "/recommendations" && (
                <span
                  aria-label={
                    ready
                      ? `${pending.length} pending recommendations`
                      : "Loading pending count"
                  }
                  className="rounded-full bg-amber-100 px-2 text-[13px] text-navy"
                >
                  {ready ? pending.length : "…"}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
