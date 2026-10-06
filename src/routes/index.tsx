import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useAdaptiveSession } from "@/hooks/useAdaptiveSession";
import { TopNav } from "@/components/adaptiq/TopNav";
import { QuizCard } from "@/components/adaptiq/QuizCard";
import { TutorPanel } from "@/components/adaptiq/TutorPanel";
import { MasteryDashboard } from "@/components/adaptiq/MasteryDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdaptIQ — Adaptive Learning & Socratic Assessment" },
      { name: "description", content: "AI-powered adaptive quizzes with a Socratic tutor that guides you to answers, plus real-time mastery analytics." },
      { property: "og:title", content: "AdaptIQ — Adaptive Learning & Socratic Assessment" },
      { property: "og:description", content: "AI-powered adaptive quizzes with a Socratic tutor and real-time mastery analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const s = useAdaptiveSession();
  return (
    <div className="min-h-screen">
      <TopNav elo={s.mastery?.elo ?? 1420} topic={s.topic} onTopic={s.changeTopic} streak={s.streak} />
      <div className={`mx-auto grid max-w-7xl ${s.tutorOpen ? "lg:grid-cols-[1fr_400px]" : ""}`}>
        <main className="space-y-6 px-4 py-6">
          <QuizCard
            question={s.question} selected={s.selected} onSelect={s.setSelected} evaluation={s.evaluation}
            loading={s.loading} answered={s.answered} onSubmit={s.submit} onNext={s.next} onHint={s.requestHint}
          />
          <MasteryDashboard mastery={s.mastery} />
          {!s.tutorOpen && s.hints.length > 0 && (
            <button onClick={() => s.setTutorOpen(true)} className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow">
              <RotateCcw className="size-4" /> Reopen tutor
            </button>
          )}
        </main>
        <TutorPanel open={s.tutorOpen} onClose={() => s.setTutorOpen(false)} hints={s.hints} submitted={!!s.evaluation} onHint={s.requestHint} />
      </div>
    </div>
  );
}
