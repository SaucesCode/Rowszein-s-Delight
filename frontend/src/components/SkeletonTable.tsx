interface SkeletonTableProps {
  /** Number of placeholder rows to show */
  rows?: number;
  /** Number of columns to show */
  cols?: number;
  /** Show a page header skeleton above the table */
  showHeader?: boolean;
}

function SkeletonCell({ width = "75%" }: { width?: string }) {
  return (
    <div
      className="skeleton rounded"
      style={{ height: 12, width, borderRadius: 6 }}
      aria-hidden="true"
    />
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  // Vary widths per cell to look more natural
  const widths = ["55%", "70%", "45%", "65%", "50%", "40%", "55%"];

  return (
    <tr style={{ borderBottom: "1px solid #F5EDE0" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5" aria-hidden="true">
          <SkeletonCell width={widths[i % widths.length]} />
        </td>
      ))}
    </tr>
  );
}

export default function SkeletonTable({
  rows = 6,
  cols = 5,
  showHeader = true,
}: SkeletonTableProps) {
  return (
    <div role="status" aria-label="Loading data…">
      {/* Optional page header skeleton */}
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div
              className="skeleton"
              style={{ height: 20, width: 140, borderRadius: 6 }}
            />
            <div
              className="skeleton"
              style={{ height: 12, width: 200, borderRadius: 6 }}
            />
          </div>
          <div
            className="skeleton"
            style={{ height: 36, width: 120, borderRadius: 10 }}
          />
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-hidden"
        style={{
          background: "#FFFDFB",
          border: "1px solid #E8E6E1",
          borderRadius: 10,
        }}
      >
        <table className="w-full" aria-hidden="true">
          {/* Column headers */}
          <thead>
            <tr style={{ background: "#F5EDE0" }}>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div
                    className="skeleton"
                    style={{ height: 10, width: "60%", borderRadius: 5 }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          {/* Placeholder rows */}
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonRow key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>

      <span className="sr-only">Loading, please wait…</span>
    </div>
  );
}