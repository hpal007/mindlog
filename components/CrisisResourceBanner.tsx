import type { CrisisPayload } from "@/lib/schemas";
import { HELPLINES, CRISIS_GROUNDING_MESSAGE } from "@/lib/constants";
import { HelplineList } from "@/components/HelplineList";

/**
 * Rendered INSTEAD of the coping flow when the result is an acute-risk payload
 * (from journal analysis or chat). Never tries to "treat" — routes to real
 * help. role="alert" so assistive tech announces it immediately.
 */
export function CrisisResourceBanner({
  payload,
  helplines: helplinesProp,
  message: messageProp,
}: {
  payload?: CrisisPayload;
  /** Direct overrides (used by tests / simple callers without a full payload). */
  helplines?: CrisisPayload["helplines"];
  message?: string;
}) {
  const helplines =
    helplinesProp?.length
      ? helplinesProp
      : payload?.helplines?.length
        ? payload.helplines
        : HELPLINES;
  const message = messageProp ?? payload?.message ?? CRISIS_GROUNDING_MESSAGE;

  return (
    <section
      role="alert"
      aria-labelledby="crisis-title"
      className="forced-border rounded-2xl border-2 border-clay-500 bg-clay-400/10 p-6"
    >
      <h2
        id="crisis-title"
        className="text-xl font-extrabold text-clay-500"
      >
        Please reach out — right now
      </h2>
      <p className="mt-2 leading-relaxed text-ink/85">{message}</p>

      <p className="mt-4 font-semibold text-ink">
        Talk to someone who can help:
      </p>
      <div className="mt-2">
        <HelplineList helplines={helplines} />
      </div>

      <p className="mt-4 rounded-xl bg-white/60 px-4 py-3 text-sm text-ink/75">
        If you can, tell a trusted adult, a teacher, or a family member how you
        are feeling. You do not have to carry this by yourself, and asking for
        help is a strong, healthy thing to do.
      </p>
    </section>
  );
}

export default CrisisResourceBanner;
