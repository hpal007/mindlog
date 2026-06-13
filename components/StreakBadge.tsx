/**
 * Shame-free streak (Finch). A gentle nudge to keep showing up — never guilt
 * for a missed day. Matches months-long prep cycles.
 */
export function StreakBadge({ days }: { days: number }) {
  const label =
    days <= 0
      ? "A fresh start — your first check-in counts."
      : days === 1
        ? "1 day of showing up for yourself."
        : `${days} days of showing up for yourself.`;

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3.5 py-1.5">
      <span aria-hidden="true" className="text-base">
        🌱
      </span>
      <span className="text-sm font-semibold text-sage-600">{label}</span>
    </div>
  );
}
