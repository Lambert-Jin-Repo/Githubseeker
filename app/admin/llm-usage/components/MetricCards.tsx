"use client";

import { useEffect, useRef, useState } from "react";

interface Summary {
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  totalSearches: number;
}

interface MetricCardsProps {
  summary: Summary;
}

function formatK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function formatCurrency(n: number): string {
  if (n < 0.01 && n > 0) return "$" + n.toFixed(4);
  return "$" + n.toFixed(2);
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  return ms + "ms";
}

function useAnimatedNumber(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = value;
    startTimeRef.current = null;

    function animate(timestamp: number) {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startRef.current + (target - startRef.current) * eased;
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

interface CardProps {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: React.ReactNode;
  colorClass: string;
}

function MetricCard({ label, value, format, icon, colorClass }: CardProps) {
  const animated = useAnimatedNumber(value);

  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-semibold text-foreground font-serif">
        {format(animated)}
      </div>
    </div>
  );
}

export function MetricCards({ summary }: MetricCardsProps) {
  const cards: CardProps[] = [
    {
      label: "Total API Calls",
      value: summary.totalCalls,
      format: (n) => formatK(Math.round(n)),
      colorClass: "bg-teal/10 text-teal",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
    {
      label: "Success Rate",
      value: summary.successRate,
      format: (n) => n.toFixed(1) + "%",
      colorClass: "bg-success/10 text-success",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Avg Latency",
      value: summary.avgLatencyMs,
      format: (n) => formatLatency(Math.round(n)),
      colorClass: "bg-amber/10 text-amber",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Tokens Used",
      value: summary.totalTokensIn + summary.totalTokensOut,
      format: (n) => formatK(Math.round(n)),
      colorClass: "bg-teal/10 text-teal",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
    },
    {
      label: "Total Cost",
      value: summary.totalCostUsd,
      format: (n) => formatCurrency(n),
      colorClass: "bg-amber/10 text-amber",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Total Searches",
      value: summary.totalSearches,
      format: (n) => Math.round(n).toString(),
      colorClass: "bg-teal/10 text-teal",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}
