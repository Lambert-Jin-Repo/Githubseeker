"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface OperationData {
  operation: string;
  calls: number;
  avgLatencyMs: number;
  totalCost: number;
}

interface OperationBarChartProps {
  data: OperationData[];
}

function formatOperation(op: string): string {
  return op
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  return ms + "ms";
}

export function OperationBarChart({ data }: OperationBarChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-sm p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
          By Operation
        </h3>
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    displayName: formatOperation(d.operation),
  }));

  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4 font-serif">
        By Operation
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formatted}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--foreground)",
                fontSize: "12px",
              }}
              formatter={(value, _name, props) => {
                const item = props.payload as OperationData & { displayName: string };
                return [
                  `${Number(value)} calls | Avg: ${formatLatency(item.avgLatencyMs)}`,
                  "Operations",
                ];
              }}
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
            />
            <Bar
              dataKey="calls"
              fill="#0F766E"
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
