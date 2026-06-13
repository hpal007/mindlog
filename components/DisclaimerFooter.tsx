import { DISCLAIMER_TEXT } from "@/lib/constants";

/** Persistent on EVERY screen (rendered in the root layout). */
export function DisclaimerFooter() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--paper)]">
      <div className="mx-auto max-w-3xl px-5 py-5">
        <p className="text-xs leading-relaxed text-ink/60">
          <span aria-hidden="true" className="mr-1">
            ⚠
          </span>
          {DISCLAIMER_TEXT}
        </p>
        <p className="mt-1.5 text-xs text-ink/70">
          If you are in immediate danger, contact local emergency services.
          MindLog stores entries privately to your account and never shares them.
        </p>
      </div>
    </footer>
  );
}
