"use client";

import { useState } from "react";
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

  return (
    <div className="grid gap-6">
      <div
        role="tablist"
        aria-label="MindLog sections"
        className="flex gap-1 rounded-2xl border border-[var(--hairline)] bg-white/50 p-1"
      >
        {TABS.map((t) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
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
