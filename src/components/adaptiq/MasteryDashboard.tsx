import { AlertTriangle, BarChart3, Target } from "lucide-react";
import type { MasteryState } from "@/services/api";

function Radar({ data }: { data: { name: string; score: number }[] }) {
  const n = data.length, c = 100, r = 72;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const poly = data.map((d, i) => pt(i, d.score / 100).join(",")).join(" ");
  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[240px]">
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={data.map((_, i) => pt(i, s).join(",")).join(" ")} className="fill-none stroke-border" />
      ))}
      {data.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="stroke-border" />; })}
      <polygon points={poly} className="fill-primary/25 stroke-primary transition-all duration-700" strokeWidth={2} />
      {data.map((d, i) => { const [x, y] = pt(i, 1.22); return <text key={d.name} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[8px]">{d.name}</text>; })}
    </svg>
  );
}

export function MasteryDashboard({ mastery }: { mastery: MasteryState | null }) {
  if (!mastery) return null;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-primary" /> Real-time Mastery</h3>
        <div className="grid items-center gap-4 sm:grid-cols-2">
          <Radar data={mastery.categories} />
          <div className="space-y-3">
            {mastery.categories.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-xs"><span>{c.name}</span><span className="font-mono text-muted-foreground">{c.score}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all duration-700 ${c.score >= 75 ? "bg-success" : c.score >= 55 ? "bg-brand" : "bg-warning"}`} style={{ width: `${c.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Diagnostic Feedback</h3>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning"><AlertTriangle className="size-3.5" /> Identified Misconceptions</p>
        <ul className="mb-5 space-y-1.5">
          {mastery.misconceptions.slice(0, 4).map((m) => (
            <li key={m} className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-sm">{m}</li>
          ))}
        </ul>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary"><Target className="size-3.5" /> Recommended Next Steps</p>
        <ul className="space-y-1.5">
          {mastery.nextSteps.map((s) => (
            <li key={s} className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">{s}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
