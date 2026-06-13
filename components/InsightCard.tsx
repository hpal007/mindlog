/**
 * A single plain-language pattern insight ("Your mood dips on days you mention
 * mock test"). This is the heart of the problem statement — patterns a plain
 * tracker misses.
 */
export function InsightCard({ text }: { text: string }) {
  return (
    <li className="flex gap-3 rounded-xl border border-sage-400/30 bg-sage-50/60 px-4 py-3">
      <span aria-hidden="true" className="mt-0.5 text-sage-500">
        ✦
      </span>
      <p className="text-[15px] leading-relaxed text-ink/85">{text}</p>
    </li>
  );
}
