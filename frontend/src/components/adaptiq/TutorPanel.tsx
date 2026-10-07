import { Brain, Lock, Sparkles, X } from "lucide-react";
import type { HintEntry } from "@/hooks/useAdaptiveSession";
import { Markdown } from "./Markdown";

const LABELS = { 1: "Hint 1 · Conceptual nudge", 2: "Hint 2 · Socratic question", 3: "Step-by-step breakdown" } as const;

export function TutorPanel({ open, onClose, hints, submitted, onHint }: {
  open: boolean; onClose: () => void; hints: HintEntry[]; submitted: boolean; onHint: () => void;
}) {
  const sorted = [...hints].sort((a, b) => a.tier - b.tier);
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card transition-transform duration-300 ease-out lg:sticky lg:top-[61px] lg:z-0 lg:h-[calc(100vh-61px)] lg:max-w-none ${open ? "translate-x-0" : "translate-x-full lg:hidden"}`}
      >
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="grid size-8 place-items-center rounded-lg bg-brand"><Brain className="size-4 text-primary-foreground" /></div>
          <div>
            <p className="text-sm font-semibold">Socratic Tutor</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 animate-pulse rounded-full bg-success" />Streaming via SSE</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">I won't give you the answer — but I'll help you find it. Request a hint to begin.</p>
          )}
          {sorted.map((h) => (
            <div key={h.tier} className="rounded-lg border border-border bg-background/50 p-3 animate-in fade-in slide-in-from-right-2">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="size-3" />{LABELS[h.tier]}
              </p>
              <div className={h.done ? "" : "caret"}><Markdown text={h.text} /></div>
            </div>
          ))}
          {!submitted && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Step-by-step breakdown unlocks after you submit.
            </div>
          )}
        </div>

        {!submitted && sorted.filter((h) => h.tier < 3).length < 2 && (
          <div className="border-t border-border p-4">
            <button onClick={onHint} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
              <Sparkles className="size-4" /> {sorted.length ? "Ask a deeper question" : "Give me a nudge"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
