/** Calm, non-judgmental empty state. */
export function EmptyState({
  icon = "🌿",
  title,
  body,
}: {
  icon?: string;
  title: string;
  body: string;
}) {
  return (
    <div className="paper-card flex flex-col items-center px-6 py-12 text-center">
      <span aria-hidden="true" className="text-4xl">
        {icon}
      </span>
      <h2 className="mt-3 text-lg font-extrabold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink/65">
        {body}
      </p>
    </div>
  );
}
