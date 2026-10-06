import type { ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length > 1)
      return <code key={key + i} className="rounded bg-code px-1.5 py-0.5 font-mono text-[0.85em] text-primary">{p.slice(1, -1)}</code>;
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={key + i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
    return p;
  });
}

const KW = /\b(def|return|print|in|for|if|else|None|is|SELECT|FROM|WHERE|AND|import|set|range|list)\b/g;

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-code">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{lang || "code"}</span>
        <span className="flex gap-1"><i className="size-2 rounded-full bg-destructive/70" /><i className="size-2 rounded-full bg-warning/70" /><i className="size-2 rounded-full bg-success/70" /></span>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        {code.split("\n").map((line, i) => (
          <div key={i}>
            {line.trim().startsWith("#") || line.trim().startsWith("--") ? (
              <span className="text-muted-foreground italic">{line}</span>
            ) : (
              line.split(KW).map((t, j) => (j % 2 ? <span key={j} className="text-violet">{t}</span> : <span key={j}>{t}</span>))
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)(?:```|$)/g);
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    const prose = parts[i];
    if (prose) {
      prose.split(/\n{2,}/).forEach((para, pi) => {
        if (!para.trim()) return;
        const lines = para.split("\n");
        if (lines.every((l) => /^\d+\.\s/.test(l.trim()) || !l.trim())) {
          out.push(
            <ol key={`${i}-${pi}`} className="my-2 list-decimal space-y-1 pl-5">
              {lines.filter((l) => l.trim()).map((l, li) => <li key={li}>{inline(l.replace(/^\d+\.\s/, ""), `${i}${pi}${li}`)}</li>)}
            </ol>,
          );
        } else out.push(<p key={`${i}-${pi}`} className="my-2">{inline(para, `${i}${pi}`)}</p>);
      });
    }
    if (parts[i + 2] !== undefined) out.push(<CodeBlock key={`c${i}`} lang={parts[i + 1] ?? ""} code={parts[i + 2]!.replace(/\n$/, "")} />);
  }
  return <div className={`text-sm leading-relaxed text-muted-foreground ${className}`}>{out}</div>;
}
