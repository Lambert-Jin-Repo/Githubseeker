"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PROVIDER_COLORS: Record<string, string> = {
  minimax: "#0F766E",
  serper: "#F59E0B",
  github: "#6366F1",
};

interface CostTimelineChartProps {
  data: Array<{ time: string; cost: number; [key: string]: string | number }>;
  providers: string[];
}

function formatTime(time: string): string {
  const date = new Date(time);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatCost(value: number): string {
  if (value < 0.01 && value > 0) return "$" + value.toFixed(4);
  return "$" + value.toFixed(2);
}

export function CostTimelineChart({ data, providers }: CostTimelineChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
          Cost Over Time
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
        Cost Over Time
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {providers.map((p) => (
                <linearGradient
                  key={p}
                  id={`gradient-${p}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={PROVIDER_COLORS[p] || "#64748B"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={PROVIDER_COLORS[p] || "#64748B"}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatCost(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
                fontSize: "12px",
              }}
              formatter={(value) => [formatCost(Number(value)), undefined]}
              labelFormatter={(label) => formatTime(String(label))}
              cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            />
            {providers.map((p) => (
              <Area
                key={p}
                type="monotone"
                dataKey={p}
                stackId="1"
                stroke={PROVIDER_COLORS[p] || "#64748B"}
                fill={`url(#gradient-${p})`}
                strokeWidth={2}
                name={p.charAt(0).toUpperCase() + p.slice(1)}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
