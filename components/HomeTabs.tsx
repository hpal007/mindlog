"use client";

import { useRef, useState } from "react";
import { JournalExperience } from "@/components/JournalExperience";
import { ChatCompanion } from "@/components/ChatCompanion";
import { TrendsView } from "@/components/TrendsView";

const TABS = [
  { id: "journal", label: "Journal" },
  { id: "companion", label: "Companion" },
  { id: "trends", label: "Trends" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Same-page tabbed shell (proper ARIA tabs) so a stressed student moves between
 * journaling, the chat companion, and their trends without losing context.
 */
export function HomeTabs() {
  const [active, setActive] = useState<TabId>("journal");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // WAI-ARIA tabs keyboard pattern: arrows move (wrapping), Home/End jump to
  // ends, moving both selection and focus to the newly selected tab.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((t) => t.id === active);
    let next = current;
    switch (e.key) {
      case "ArrowRight":
        next = (current + 1) % TABS.length;
        break;
      case "ArrowLeft":
        next = (current - 1 + TABS.length) % TABS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = TABS.length - 1;
        break;
      default:
        return;
    }
    const target = TABS[next];
    if (!target) return;
    e.preventDefault();
    setActive(target.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="grid gap-6">
      <div
        role="tablist"
        aria-label="MindLog sections"
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-2xl border border-[var(--hairline)] bg-white/50 p-1"
      >
        {TABS.map((t, i) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => setActive(t.id)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                selected
                  ? "bg-sage-600 text-white"
                  : "text-ink/65 hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="panel-journal"
        aria-labelledby="tab-journal"
        hidden={active !== "journal"}
      >
        {active === "journal" ? <JournalExperience /> : null}
      </div>
      <div
        role="tabpanel"
        id="panel-companion"
        aria-labelledby="tab-companion"
        hidden={active !== "companion"}
      >
        {active === "companion" ? <ChatCompanion /> : null}
      </div>
      <div
        role="tabpanel"
        id="panel-trends"
        aria-labelledby="tab-trends"
        hidden={active !== "trends"}
      >
        {active === "trends" ? <TrendsView /> : null}
      </div>
    </div>
  );
}
