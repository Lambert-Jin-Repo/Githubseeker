"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const MODE_COLORS: Record<string, string> = {
  LEARN: "#0F766E",
  BUILD: "#F59E0B",
  SCOUT: "#6366F1",
  UNKNOWN: "#64748B",
};

interface SearchAnalyticsData {
  totalSearches: number;
  completedSearches: number;
  modeDistribution: Array<{ mode: string; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  searchesPerDay: Array<{ date: string; count: number }>;
  avgReposPerSearch: number;
  costPerSearch: Array<{ search_id: string; total_cost: number }>;
}

interface SearchAnalyticsPanelProps {
  data: SearchAnalyticsData;
}

function formatCurrency(n: number): string {
  if (n < 0.01 && n > 0) return "$" + n.toFixed(4);
  return "$" + n.toFixed(2);
}

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function SearchAnalyticsPanel({ data }: SearchAnalyticsPanelProps) {
  return (
    <div className="rounded-xl bg-card border border-border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground mb-5 font-serif">
        Search Analytics
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mode Distribution */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Mode Distribution
          </h4>
          {data.modeDistribution.length > 0 ? (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.modeDistribution}
                    dataKey="count"
                    nameKey="mode"
                    cx="50%"
                    cy="50%"
                    outerRadius={55}
                    strokeWidth={0}
                  >
                    {data.modeDistribution.map((entry) => (
                      <Cell
                        key={entry.mode}
                        fill={MODE_COLORS[entry.mode] || "#64748B"}
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
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                {data.modeDistribution.map((d) => (
                  <div
                    key={d.mode}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: MODE_COLORS[d.mode] || "#64748B",
                      }}
                    />
                    <span className="text-muted-foreground">{d.mode}</span>
                    <span className="text-foreground font-medium">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
              No searches
            </div>
          )}
        </div>

        {/* Top Topics */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Top Topics
          </h4>
          {data.topTopics.length > 0 ? (
            <ul className="space-y-2">
              {data.topTopics.slice(0, 5).map((t, i) => (
                <li key={t.topic} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">
                    {i + 1}.
                  </span>
                  <span className="text-sm text-foreground truncate flex-1">
                    {t.topic}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-muted-foreground">
              No topics yet
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {/* Avg repos */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Avg Repos / Search
            </h4>
            <div className="text-2xl font-semibold text-foreground font-serif">
              {data.avgReposPerSearch}
            </div>
          </div>

          {/* Completion rate */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Completion Rate
            </h4>
            <div className="text-2xl font-semibold text-foreground font-serif">
              {data.totalSearches > 0
                ? (
                    (data.completedSearches / data.totalSearches) *
                    100
                  ).toFixed(0)
                : 0}
              %
            </div>
          </div>

          {/* Top cost searches */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Top Cost Searches
            </h4>
            {data.costPerSearch.length > 0 ? (
              <ul className="space-y-1">
                {data.costPerSearch.slice(0, 3).map((c) => (
                  <li
                    key={c.search_id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground font-mono truncate max-w-[120px]">
                      {c.search_id.slice(0, 8)}...
                    </span>
                    <span className="text-foreground font-medium">
                      {formatCurrency(c.total_cost)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-muted-foreground">No cost data</span>
            )}
          </div>
        </div>
      </div>

      {/* Searches per day */}
      {data.searchesPerDay.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Searches Per Day
          </h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.searchesPerDay}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="searchGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "12px",
                  }}
                  labelFormatter={(label) => formatDate(String(label))}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#0F766E"
                  fill="url(#searchGradient)"
                  strokeWidth={2}
                  name="Searches"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
