import { CheckCircle2, ChevronRight, Loader2, Sparkles, XCircle } from "lucide-react";
import type { EvaluationResponse, Question } from "@/services/api";
import { SESSION_LENGTH } from "@/hooks/useAdaptiveSession";
import { Markdown } from "./Markdown";

interface Props {
  question: Question | null; selected: string | null; onSelect: (id: string) => void;
  evaluation: EvaluationResponse | null; loading: boolean; answered: number;
  onSubmit: () => void; onNext: () => void; onHint: () => void;
}

export function QuizCard({ question, selected, onSelect, evaluation, loading, answered, onSubmit, onNext, onHint }: Props) {
  const progress = Math.min(100, (answered / SESSION_LENGTH) * 100);
  const level = question?.difficulty ?? 1;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Session progress · {answered}/{SESSION_LENGTH}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Difficulty</span>
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} className={`h-2 w-4 rounded-sm transition-colors ${l <= level ? "bg-brand" : "bg-muted"}`} />
            ))}
            <span className="font-mono font-semibold text-primary">L{level}</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        {!question ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div key={question.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-primary">{question.skill}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{question.topic}</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{question.title}</h2>
            <Markdown text={question.body} className="mt-2" />

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {question.options.map((o, i) => {
                const isSel = selected === o.id;
                const isCorrect = evaluation?.correctOptionId === o.id;
                const isWrong = evaluation && isSel && !evaluation.correct;
                const state = evaluation
                  ? isCorrect ? "border-success ring-2 ring-success/60 bg-success/10"
                  : isWrong ? "border-destructive ring-2 ring-destructive/60 bg-destructive/10"
                  : "opacity-50 border-border"
                  : isSel ? "border-primary ring-2 ring-primary/50 bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-accent/40 hover:-translate-y-0.5";
                return (
                  <button
                    key={o.id}
                    disabled={!!evaluation}
                    onClick={() => onSelect(o.id)}
                    className={`group flex items-center gap-3 rounded-lg border p-3.5 text-left text-sm transition-all duration-200 active:scale-[0.98] ${state}`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-md font-mono text-xs ${isSel && !evaluation ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 font-mono">{o.text}</span>
                    {evaluation && isCorrect && <CheckCircle2 className="size-5 text-success" />}
                    {isWrong && <XCircle className="size-5 text-destructive" />}
                  </button>
                );
              })}
            </div>

            {evaluation && (
              <div className={`mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm animate-in fade-in ${evaluation.correct ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                {evaluation.correct ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {evaluation.correct ? "Correct!" : "Not quite."}
                <span className="ml-auto font-mono">{evaluation.eloDelta > 0 ? "+" : ""}{evaluation.eloDelta} Elo</span>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <button
                onClick={onHint}
                disabled={!!evaluation}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                <Sparkles className="size-4" /> Request Socratic Hint
              </button>
              <div className="flex gap-2 sm:ml-auto">
                {!evaluation ? (
                  <button
                    onClick={onSubmit}
                    disabled={!selected || loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 disabled:opacity-40"
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />} Submit Answer
                  </button>
                ) : (
                  <button
                    onClick={onNext}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-primary/50 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    Next Question <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
