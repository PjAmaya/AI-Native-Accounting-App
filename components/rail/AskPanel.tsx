"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2, Wrench, TriangleAlert, FilePlus2, ArrowUpRight } from "lucide-react";

type Step = { tool: string; args: Record<string, unknown>; ok: boolean; write?: boolean; link?: string };

type Turn = {
  question: string;
  answer: string | null;
  steps: Step[];
  warnings: string[];
  error: string | null;
};

const SUGGESTIONS = [
  "Why is cash lower than profit?",
  "Which invoices are overdue?",
  "What is my margin by project?",
  "Draft an invoice for 10 hours at $200",
];

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setQuestion("");
    setBusy(true);
    setTurns((prev) => [...prev, { question: trimmed, answer: null, steps: [], warnings: [], error: null }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();

      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (response.ok) {
          next[next.length - 1] = {
            ...last,
            answer: data.answer,
            steps: data.steps ?? [],
            warnings: data.warnings ?? [],
          };
        } else {
          next[next.length - 1] = { ...last, error: data.error ?? "Something went wrong." };
        }
        return next;
      });
    } catch (e) {
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], error: (e as Error).message };
        return next;
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="border-t border-rule">
      {turns.length > 0 ? (
        <div ref={scroller} className="max-h-80 overflow-y-auto px-5 py-3">
          <ul className="grid gap-4">
            {turns.map((turn, i) => (
              <li key={i}>
                <p className="text-[12px] font-medium text-muted">{turn.question}</p>

                {turn.error ? (
                  <p className="mt-1.5 text-[13px] leading-snug text-negative">{turn.error}</p>
                ) : turn.answer === null ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-faint">
                    <Loader2 size={13} strokeWidth={2} className="animate-spin" aria-hidden />
                    Reading the books
                  </p>
                ) : (
                  <>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] leading-snug text-ink">
                      {turn.answer}
                    </p>
                    {turn.warnings.length > 0 ? (
                      <ul className="mt-2 grid gap-1 rounded-md bg-tint-amber/50 px-2.5 py-2">
                        {turn.warnings.map((w, wi) => (
                          <li
                            key={wi}
                            className="flex items-start gap-1.5 text-[11px] leading-snug text-icon-amber"
                          >
                            <TriangleAlert
                              size={11}
                              strokeWidth={2.2}
                              aria-hidden
                              className="mt-0.5 shrink-0"
                            />
                            {w}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {turn.steps.filter((s) => s.write && s.ok && s.link).length > 0 ? (
                      <ul className="mt-2 grid gap-1">
                        {turn.steps
                          .filter((s) => s.write && s.ok && s.link)
                          .map((s, si) => (
                            <li key={si}>
                              <a
                                href={s.link}
                                className="flex items-center justify-between gap-2 rounded-md border border-brand/25 bg-brand-soft px-2.5 py-2 text-[12px] font-medium text-brand hover:bg-brand-soft/70"
                              >
                                <span className="flex items-center gap-1.5">
                                  <FilePlus2 size={12} strokeWidth={2.2} aria-hidden />
                                  Draft created — open it
                                </span>
                                <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden />
                              </a>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                    {turn.steps.length > 0 ? (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-faint">
                        <Wrench size={11} strokeWidth={2} aria-hidden />
                        {turn.steps.map((s) => s.tool).join(", ")}
                      </p>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="px-5 py-3">
          <p className="eyebrow">Ask the books</p>
          <ul className="mt-2 grid gap-1.5">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  className="w-full rounded-md border border-rule px-2.5 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-wash/50 hover:text-ink"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 pb-4 pt-1">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={1}
            placeholder="Ask a question"
            aria-label="Ask a question about the books"
            className="max-h-24 flex-1 resize-none rounded-lg border border-rule bg-surface px-3 py-2 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="button"
            onClick={() => ask(question)}
            disabled={busy || !question.trim()}
            aria-label="Send"
            className="rounded-lg bg-brand p-2 text-white transition-colors hover:bg-[#1731c9] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={15} strokeWidth={2.2} className="animate-spin" aria-hidden />
            ) : (
              <ArrowUp size={15} strokeWidth={2.2} aria-hidden />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-faint">
          Answers come from your ledger. It can create drafts, but cannot issue, post or pay.
        </p>
      </div>
    </div>
  );
}
