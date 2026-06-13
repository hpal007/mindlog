"use client";

import { useRef } from "react";
import { NAV_ITEMS, panelId, type NavId } from "@/components/navItems";

type SideNavProps = {
  active: NavId;
  onSelect: (id: NavId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

/**
 * Desktop left rail — a real WAI-ARIA vertical tablist. Roving tabIndex, arrow
 * keys move (wrapping) and Home/End jump, with selection following focus. The
 * canonical tablist lives here (the mobile drawer uses a plain nav menu) so
 * there are never duplicate role="tab" ids in the DOM.
 */
export function SideNav({
  active,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: SideNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = NAV_ITEMS.findIndex((t) => t.id === active);
    let next = current;
    switch (e.key) {
      case "ArrowDown":
        next = (current + 1) % NAV_ITEMS.length;
        break;
      case "ArrowUp":
        next = (current - 1 + NAV_ITEMS.length) % NAV_ITEMS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = NAV_ITEMS.length - 1;
        break;
      default:
        return;
    }
    const target = NAV_ITEMS[next];
    if (!target) return;
    e.preventDefault();
    onSelect(target.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="MindLog sections"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1"
      >
        {NAV_ITEMS.map(({ id, label, Icon }, i) => {
          const selected = active === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls={panelId(id)}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex items-center rounded-xl text-sm font-bold transition-colors ${
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"
              } ${
                selected
                  ? "bg-sage-600 text-white"
                  : "text-ink/65 hover:bg-sage-50 hover:text-ink"
              }`}
            >
              <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        className={`mt-auto flex items-center rounded-xl text-sm font-semibold text-ink/55 transition-colors hover:bg-sage-50 hover:text-ink ${
          collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 transition-transform ${
            collapsed ? "" : "rotate-180"
          }`}
        >
          <path d="m14 7-5 5 5 5" />
        </svg>
        <span className={collapsed ? "sr-only" : ""}>Collapse</span>
      </button>
    </div>
  );
}
