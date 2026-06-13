import { HomeTabs } from "@/components/HomeTabs";

export default function HomePage() {
  return (
    <div className="grid gap-6">
      <section className="animate-rise">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          How are you, really?
        </h1>
        <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed text-ink/65">
          A private space to put exam-season pressure into words — and to notice
          what is quietly building underneath.
        </p>
      </section>

      <HomeTabs />
    </div>
  );
}
