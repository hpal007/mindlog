"use client";

import { useEffect, useRef } from "react";
import { NAV_ITEMS, type NavId } from "@/components/navItems";

type MobileNavDrawerProps = {
  open: boolean;
  active: NavId;
  onSelect: (id: NavId) => void;
  onClose: () => void;
};

/**
 * Mobile off-canvas navigation. A focus-managed dialog (Escape / scrim click to
 * close, focus moved in on open) mirroring SosButton. It is a plain nav menu —
 * NOT a second role="tab" list — so the canonical desktop tablist stays the only
 * source of tab ids.
 */
export function MobileNavDrawer({
  open,
  active,
  onSelect,
  onClose,
}: MobileNavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex md:hidden"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="MindLog sections"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-72 max-w-[80vw] flex-col gap-1 border-r border-[var(--hairline)] bg-[var(--paper-raised)] p-4 outline-none"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-base font-extrabold tracking-tight text-ink">
            Mind<span className="text-sage-500">Log</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg px-2 py-1 text-xl leading-none text-ink/70 hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav aria-label="Sections" className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition-colors ${
                  selected
                    ? "bg-sage-600 text-white"
                    : "text-ink/65 hover:bg-sage-50 hover:text-ink"
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
