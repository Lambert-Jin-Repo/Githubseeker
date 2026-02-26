import type { ScoutSummaryV2 } from "@/lib/types";

interface ComparativeMatrixProps {
  summary: ScoutSummaryV2;
}

export function ComparativeMatrix({ summary }: ComparativeMatrixProps) {
  const { dimensions, repos } = summary.comparative_matrix;

  if (dimensions.length === 0 || repos.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="p-6 pb-4">
        <h2 className="font-serif text-xl text-foreground">
          Comparative Matrix
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Dimension
              </th>
              {repos.map((repo) => {
                const anchor = repoAnchor(repo.repo_name);
                return (
                  <th
                    key={repo.repo_name}
                    className="px-4 py-3 text-left font-medium text-foreground"
                  >
                    <a
                      href={`#${anchor}`}
                      className="inline-block max-w-[140px] truncate transition-colors hover:text-teal"
                      title={repo.repo_name}
                    >
                      {repo.repo_name}
                    </a>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dimension) => (
              <tr key={dimension}>
                <td className="px-4 py-2.5 border-b border-border/30 font-medium text-muted-foreground">
                  {dimension}
                </td>
                {repos.map((repo) => (
                  <td
                    key={repo.repo_name}
                    className="px-4 py-2.5 border-b border-border/30 text-foreground"
                  >
                    {repo.values[dimension] ?? "\u2014"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Generates a consistent anchor ID from a repo name like "owner/repo" */
function repoAnchor(repoName: string): string {
  return `repo-${repoName.replace("/", "-")}`;
}
