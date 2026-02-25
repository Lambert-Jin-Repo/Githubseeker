"use client";

const EXAMPLES = [
  { query: "How to learn building AI agents with Python", mode: "LEARN" as const },
  { query: "Template for Next.js SaaS with authentication", mode: "BUILD" as const },
  { query: "What open source CRM alternatives exist", mode: "SCOUT" as const },
  { query: "AI agent frameworks for customer support", mode: "BUILD" as const },
  { query: "Compare vector database solutions", mode: "SCOUT" as const },
];

interface ExampleQueriesProps {
  onSelect: (query: string) => void;
}

export function ExampleQueries({ onSelect }: ExampleQueriesProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {EXAMPLES.map((example, i) => (
        <button
          key={i}
          onClick={() => onSelect(example.query)}
          className={`animate-slide-up rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-teal/30 hover:text-foreground hover:shadow-sm delay-${i + 1}`}
        >
          {example.query}
        </button>
      ))}
    </div>
  );
}
