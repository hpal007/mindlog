"use client";

import { useRef, useState } from "react";
import type { CrisisPayload } from "@/lib/schemas";
import { crisisPayloadSchema } from "@/lib/schemas";
import { readTextOrNdjson } from "@/components/lib/stream";
import { CrisisResourceBanner } from "@/components/CrisisResourceBanner";

type Msg = { id: string; role: "user" | "assistant"; text: string };

/**
 * Streaming chat companion. Renders assistant tokens as they arrive. If the API
 * returns a crisis JSON payload (risk:"acute") instead of a normal reply, the
 * conversation hard-stops to the CrisisResourceBanner — it never "treats" risk.
 */
export function ChatCompanion({ entryId }: { entryId?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState<CrisisPayload | null>(null);
  const [error, setError] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollDown = () =>
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;

    setError(false);
    setDraft("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: message };
    const replyId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: replyId, role: "assistant", text: "" }]);
    setBusy(true);
    scrollDown();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, entry_id: entryId }),
      });
      if (!res.ok || !res.body) throw new Error("chat failed");

      await readTextOrNdjson(
        res.body,
        (chunk) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === replyId ? { ...msg, text: msg.text + chunk } : msg,
            ),
          );
          scrollDown();
        },
        (obj) => {
          const parsed = crisisPayloadSchema.safeParse(obj);
          if (parsed.success) setCrisis(parsed.data);
        },
      );
    } catch {
      setError(true);
      setMessages((m) => m.filter((msg) => msg.id !== replyId || msg.text));
    } finally {
      setBusy(false);
    }
  };

  if (crisis) return <CrisisResourceBanner payload={crisis} />;

  return (
    <section aria-label="Chat companion" className="paper-card flex flex-col p-5">
      <div
        ref={logRef}
        className="flex max-h-[50dvh] min-h-[8rem] flex-col gap-3 overflow-y-auto pb-2"
        aria-live="polite"
        aria-busy={busy}
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/55">
            I am here to listen. Tell me how things are going.
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
              m.role === "user"
                ? "self-end bg-sage-600 text-white"
                : "self-start bg-sage-50 text-ink"
            }`}
          >
            {m.text ||
              (m.role === "assistant" && busy ? (
                <span className="text-ink/50">thinking…</span>
              ) : null)}
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mb-2 text-sm text-clay-500">
          Something went wrong. Please try again.
        </p>
      ) : null}

      <form onSubmit={send} className="mt-2 flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only-focusable">
          Message the companion
        </label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
          rows={1}
          maxLength={2000}
          placeholder="Type a message…"
          className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-[var(--hairline)] bg-white/70 px-4 py-2.5 text-[15px] text-ink placeholder:text-ink/40"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="rounded-xl bg-sage-600 px-4 py-2.5 font-bold text-white transition-colors hover:bg-sage-500 disabled:bg-ink/20"
        >
          Send
        </button>
      </form>
    </section>
  );
}
