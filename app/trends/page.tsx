import Link from "next/link";
import { TrendsView } from "@/components/TrendsView";

export default function TrendsPage() {
  return (
    <div className="grid gap-6">
      <section className="animate-rise">
        <Link
          href="/"
          className="inline-block rounded-lg text-sm font-semibold text-sage-600 hover:text-sage-500"
        >
          ← Back to journal
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Your patterns
        </h1>
        <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-ink/65">
          How your mood has moved, what comes up most, and the patterns a plain
          tracker would miss.
        </p>
      </section>

      <TrendsView />
    </div>
  );
}
