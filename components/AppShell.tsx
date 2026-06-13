"use client";

import { useEffect, useRef, useState } from "react";
import { JournalExperience } from "@/components/JournalExperience";
import { ChatCompanion } from "@/components/ChatCompanion";
import { TrendsView } from "@/components/TrendsView";
import { SideNav } from "@/components/SideNav";
import { MobileNavDrawer } from "@/components/MobileNavDrawer";
import { NAV_ITEMS, panelId, type NavId } from "@/components/navItems";

const COLLAPSE_KEY = "mindlog:nav-collapsed";

/**
 * Full-page shell: a calm left rail (collapsible, desktop) + full-width content,
 * with an off-canvas drawer standing in for the rail on mobile. Owns the active
 * section plus collapsed/drawer state and renders the three section panels.
 */
export function AppShell() {
  const [active, setActive] = useState<NavId>("journal");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Restore the collapsed preference after mount (avoids a hydration mismatch;
  // server always renders expanded).
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  // Return focus to the hamburger when the drawer closes.
  const closeDrawer = () => {
    setDrawerOpen(false);
    hamburgerRef.current?.focus();
  };

  const activeItem = NAV_ITEMS.find((t) => t.id === active) ?? NAV_ITEMS[0]!;

  return (
    <div className="flex w-full">
      {/* Desktop rail */}
      <aside
        className={`sticky hidden shrink-0 self-start overflow-hidden border-r border-[var(--hairline)] bg-[var(--paper-raised)] transition-[width] md:block ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
        style={{ top: "var(--header-h)", height: "calc(100dvh - var(--header-h))" }}
      >
        <SideNav
          active={active}
          onSelect={setActive}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <MobileNavDrawer
        open={drawerOpen}
        active={active}
        onSelect={setActive}
        onClose={closeDrawer}
      />

      {/* Content */}
      <section className="min-w-0 flex-1 px-5 py-6 sm:px-6 lg:px-8">
        {/* Mobile section bar */}
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-label="Open navigation"
            className="rounded-xl border border-[var(--hairline)] bg-[var(--paper-raised)] p-2.5 text-ink/70 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="text-sm font-bold text-ink">{activeItem.label}</span>
        </div>

        <header key={active} className="animate-rise">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {activeItem.title}
          </h1>
          <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-ink/65">
            {activeItem.subtitle}
          </p>
        </header>

        <div className="mt-6">
          <div
            role="tabpanel"
            id={panelId("journal")}
            aria-label="Journal"
            hidden={active !== "journal"}
            className="max-w-[720px]"
          >
            {active === "journal" ? <JournalExperience /> : null}
          </div>
          <div
            role="tabpanel"
            id={panelId("companion")}
            aria-label="Companion"
            hidden={active !== "companion"}
            className="max-w-[820px]"
          >
            {active === "companion" ? <ChatCompanion /> : null}
          </div>
          <div
            role="tabpanel"
            id={panelId("trends")}
            aria-label="Trends"
            hidden={active !== "trends"}
            className="max-w-[1100px]"
          >
            {active === "trends" ? <TrendsView /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
