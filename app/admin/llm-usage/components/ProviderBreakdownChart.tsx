"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PROVIDER_COLORS: Record<string, string> = {
  minimax: "#0F766E",
  serper: "#F59E0B",
  github: "#6366F1",
};

interface ProviderData {
  provider: string;
  calls: number;
  successRate: number;
  avgLatencyMs: number;
  totalCost: number;
}

interface ProviderBreakdownChartProps {
  data: ProviderData[];
}

export function ProviderBreakdownChart({ data }: ProviderBreakdownChartProps) {
  const totalCalls = data.reduce((sum, d) => sum + d.calls, 0);

  if (!data.length) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
          Provider Breakdown
        </h3>
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
        Provider Breakdown
      </h3>
      <div className="h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="calls"
              nameKey="provider"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.provider}
                  fill={PROVIDER_COLORS[entry.provider] || "#64748B"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
                fontSize: "12px",
              }}
              formatter={(value, name) => {
                const v = Number(value);
                const pct =
                  totalCalls > 0
                    ? ((v / totalCalls) * 100).toFixed(1) + "%"
                    : "0%";
                return [`${v} calls (${pct})`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-semibold text-foreground font-serif">
              {totalCalls}
            </div>
            <div className="text-xs text-muted-foreground">calls</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {data.map((d) => (
          <div key={d.provider} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: PROVIDER_COLORS[d.provider] || "#64748B",
              }}
            />
            <span className="text-muted-foreground capitalize">
              {d.provider}
            </span>
            <span className="text-foreground font-medium">{d.calls}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
