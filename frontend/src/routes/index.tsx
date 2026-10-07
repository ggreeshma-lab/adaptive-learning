import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { AuthGate } from "@/components/adaptiq/AuthGate";
import { useAdaptiveSession } from "@/hooks/useAdaptiveSession";
import { TopNav } from "@/components/adaptiq/TopNav";
import { QuizCard } from "@/components/adaptiq/QuizCard";
import { TutorPanel } from "@/components/adaptiq/TutorPanel";
import { MasteryDashboard } from "@/components/adaptiq/MasteryDashboard";
import type { AuthUser } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdaptIQ — Adaptive Learning & Socratic Assessment" },
      {
        name: "description",
        content:
          "AI-powered adaptive quizzes with a Socratic tutor that guides you to answers, plus real-time mastery analytics.",
      },
      { property: "og:title", content: "AdaptIQ — Adaptive Learning & Socratic Assessment" },
      {
        property: "og:description",
        content:
          "AI-powered adaptive quizzes with a Socratic tutor and real-time mastery analytics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AuthGate>{(user, onLogout) => <LearningSession user={user} onLogout={onLogout} />}</AuthGate>
  );
}

function LearningSession({ user, onLogout }: { user: AuthUser; onLogout: () => Promise<void> }) {
  const s = useAdaptiveSession();
  return (
    <div className="min-h-screen">
      <TopNav
        elo={s.mastery?.elo ?? 1420}
        topic={s.topic}
        onTopic={s.changeTopic}
        streak={s.streak}
        email={user.email}
        onLogout={() => void onLogout()}
      />
      <div className={`mx-auto grid max-w-7xl ${s.tutorOpen ? "lg:grid-cols-[1fr_400px]" : ""}`}>
        <main className="space-y-6 px-4 py-6">
          {s.questionError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              <span>{s.questionError}</span>
              <button
                onClick={s.retryQuestion}
                className="rounded-md border border-current px-3 py-1.5 font-medium"
              >
                Retry
              </button>
            </div>
          )}
          {s.actionError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {s.actionError}
            </div>
          )}
          <QuizCard
            question={s.question}
            selected={s.selected}
            onSelect={s.setSelected}
            evaluation={s.evaluation}
            loading={s.loading}
            answered={s.answered}
            onSubmit={s.submit}
            onNext={s.next}
            onHint={s.requestHint}
          />
          <MasteryDashboard mastery={s.mastery} />
          {!s.tutorOpen && s.hints.length > 0 && (
            <button
              onClick={() => s.setTutorOpen(true)}
              className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <RotateCcw className="size-4" /> Reopen tutor
            </button>
          )}
        </main>
        <TutorPanel
          open={s.tutorOpen}
          onClose={() => s.setTutorOpen(false)}
          hints={s.hints}
          submitted={!!s.evaluation}
          onHint={s.requestHint}
        />
      </div>
    </div>
  );
}
