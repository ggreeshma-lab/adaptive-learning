import { useEffect, useState } from "react";
import { Brain, ChevronDown, Flame, Timer } from "lucide-react";
import { TOPICS, type Topic } from "@/services/api";

const tierName = (elo: number) =>
  elo < 1200 ? "Novice" : elo < 1500 ? "Intermediate" : elo < 1800 ? "Advanced" : "Expert";

export function TopNav({
  elo,
  topic,
  onTopic,
  streak,
  email,
  onLogout,
}: {
  elo: number;
  topic: Topic;
  onTopic: (t: Topic) => void;
  streak: number;
  email: string;
  onLogout: () => void;
}) {
  const [secs, setSecs] = useState(0);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await onLogout();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Unable to log out.");
    }
  };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-brand shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">AdaptIQ</span>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            AI Native
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={topic}
              onChange={(e) => onTopic(e.target.value as Topic)}
              className="appearance-none rounded-lg border border-border bg-card py-1.5 pl-3 pr-8 text-sm outline-none transition-colors hover:border-primary/50 focus:ring-2 focus:ring-ring"
            >
              {TOPICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <span className="rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs">
            Elo: <span className="text-brand font-bold">{elo}</span>{" "}
            <span className="text-muted-foreground">• {tierName(elo)}</span>
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs">
            <Flame className="size-3.5 text-warning" />
            {streak}
          </span>
          <span className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
            <Timer className="size-3.5" />
            {mm}:{ss}
          </span>
          <button
            onClick={() => void handleLogout()}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            title={`Signed in as ${email}`}
          >
            Log out
          </button>
        </div>
      </div>
      {logoutError && (
        <p
          role="alert"
          className="border-t border-destructive/40 px-4 py-2 text-center text-xs text-destructive"
        >
          {logoutError}
        </p>
      )}
    </header>
  );
}
