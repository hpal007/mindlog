"use client";

import { useEffect, useRef, useState } from "react";
import {
  HELPLINES,
  CRISIS_GROUNDING_MESSAGE,
} from "@/lib/constants";
import { HelplineList } from "@/components/HelplineList";

/**
 * Always-visible, every-screen SOS. Opens a focus-trapped dialog with the India
 * helplines (tappable tel: links) and a grounding step. Reachable on demand —
 * not only when the model detects crisis. (Safety table-stakes.)
 */
export function SosButton() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Return focus to the trigger when the dialog closes.
  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-clay-600 bg-clay-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-clay-700"
      >
        <span aria-hidden="true" className="mr-1">
          ♥
        </span>
        Need help now
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sos-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="paper-card max-h-[85dvh] w-full max-w-md overflow-y-auto p-6 outline-none"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h2 id="sos-title" className="text-lg font-extrabold text-ink">
                You are not alone
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-xl leading-none text-ink/60 hover:text-ink"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-ink/80">
              {CRISIS_GROUNDING_MESSAGE}
            </p>

            <div className="mb-4 rounded-xl bg-sage-50 p-4">
              <p className="text-sm font-semibold text-sage-600">
                A grounding step, right now
              </p>
              <p className="mt-1 text-sm text-ink/75">
                Breathe in slowly for 4 counts, hold for 4, out for 6. Notice
                five things you can see around you. You have got through hard
                moments before.
              </p>
            </div>

            <HelplineList helplines={HELPLINES} />
          </div>
        </div>
      ) : null}
    </>
  );
}
