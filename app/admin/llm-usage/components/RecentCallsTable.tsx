"use client";

import { useState } from "react";

const PROVIDER_COLORS: Record<string, string> = {
  minimax: "#0F766E",
  serper: "#F59E0B",
  github: "#6366F1",
};

interface RecentCall {
  created_at: string;
  provider: string;
  model: string;
  operation: string;
  success: boolean;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  error_type: string;
  tool_round: number;
}

interface RecentCallsTableProps {
  calls: RecentCall[];
}

type SortKey = "created_at" | "latency_ms" | "tokens_in" | "cost_usd";
type SortDir = "asc" | "desc";

function formatTime(time: string): string {
  const date = new Date(time);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLatency(ms: number): string {
  if (!ms) return "-";
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  return ms + "ms";
}

function formatTokens(tokens_in: number, tokens_out: number): string {
  const total = (tokens_in || 0) + (tokens_out || 0);
  if (total === 0) return "-";
  if (total >= 1000) return (total / 1000).toFixed(1) + "K";
  return total.toString();
}

function formatCost(cost: string): string {
  const n = parseFloat(cost || "0");
  if (n === 0) return "-";
  if (n < 0.01) return "$" + n.toFixed(4);
  return "$" + n.toFixed(2);
}

function formatOperation(op: string): string {
  return op
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentCallsTable({ calls }: RecentCallsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...calls].sort((a, b) => {
    let av: number, bv: number;
    switch (sortKey) {
      case "created_at":
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
        break;
      case "latency_ms":
        av = a.latency_ms || 0;
        bv = b.latency_ms || 0;
        break;
      case "tokens_in":
        av = (a.tokens_in || 0) + (a.tokens_out || 0);
        bv = (b.tokens_in || 0) + (b.tokens_out || 0);
        break;
      case "cost_usd":
        av = parseFloat(a.cost_usd || "0");
        bv = parseFloat(b.cost_usd || "0");
        break;
    }
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <svg
      className={`w-3 h-3 inline-block ml-0.5 ${
        active ? "text-foreground" : "text-muted-foreground/40"
      }`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      {dir === "desc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      )}
    </svg>
  );

  if (!calls.length) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
          Recent Calls
        </h3>
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          No recent API calls
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
        Recent Calls
      </h3>

      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                className="text-left py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("created_at")}
              >
                Time
                <SortIcon
                  active={sortKey === "created_at"}
                  dir={sortKey === "created_at" ? sortDir : "desc"}
                />
              </th>
              <th className="text-left py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Provider
              </th>
              <th className="text-left py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                Operation
              </th>
              <th
                className="text-right py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("latency_ms")}
              >
                Latency
                <SortIcon
                  active={sortKey === "latency_ms"}
                  dir={sortKey === "latency_ms" ? sortDir : "desc"}
                />
              </th>
              <th
                className="text-right py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none hidden sm:table-cell"
                onClick={() => handleSort("tokens_in")}
              >
                Tokens
                <SortIcon
                  active={sortKey === "tokens_in"}
                  dir={sortKey === "tokens_in" ? sortDir : "desc"}
                />
              </th>
              <th
                className="text-right py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("cost_usd")}
              >
                Cost
                <SortIcon
                  active={sortKey === "cost_usd"}
                  dir={sortKey === "cost_usd" ? sortDir : "desc"}
                />
              </th>
              <th className="text-center py-2.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((call, i) => (
              <>
                <tr
                  key={`row-${i}`}
                  className="border-b border-border/50 hover:bg-background/50 cursor-pointer transition-colors"
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                >
                  <td className="py-2.5 px-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(call.created_at)}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white capitalize"
                      style={{
                        backgroundColor:
                          PROVIDER_COLORS[call.provider] || "#64748B",
                      }}
                    >
                      {call.provider}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-xs text-foreground hidden md:table-cell">
                    {formatOperation(call.operation)}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-foreground text-right font-mono">
                    {formatLatency(call.latency_ms)}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-foreground text-right font-mono hidden sm:table-cell">
                    {formatTokens(call.tokens_in, call.tokens_out)}
                  </td>
                  <td className="py-2.5 px-2 text-xs text-foreground text-right font-mono">
                    {formatCost(call.cost_usd)}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {call.success ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-success" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
                    )}
                  </td>
                </tr>

                {expandedRow === i && (
                  <tr key={`detail-${i}`}>
                    <td
                      colSpan={7}
                      className="py-3 px-4 bg-background/50 text-xs"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <span className="text-muted-foreground">Model:</span>{" "}
                          <span className="text-foreground font-mono">
                            {call.model || "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Tokens In:
                          </span>{" "}
                          <span className="text-foreground font-mono">
                            {call.tokens_in || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Tokens Out:
                          </span>{" "}
                          <span className="text-foreground font-mono">
                            {call.tokens_out || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Tool Round:
                          </span>{" "}
                          <span className="text-foreground font-mono">
                            {call.tool_round ?? "-"}
                          </span>
                        </div>
                        {call.error_type && (
                          <div className="col-span-2 sm:col-span-4">
                            <span className="text-muted-foreground">Error:</span>{" "}
                            <span className="text-destructive font-mono">
                              {call.error_type}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
