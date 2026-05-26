const COLORS: Record<string, { bg: string; color: string }> = {
  scheduled:     { bg: "#eff6ff", color: "#1d4ed8" },
  completed:     { bg: "#f0fdf4", color: "#15803d" },
  cancelled:     { bg: "#fef2f2", color: "#b91c1c" },
  no_show:       { bg: "#fef9c3", color: "#854d0e" },
  new:           { bg: "#f1f5f9", color: "#475569" },
  contacted:     { bg: "#eff6ff", color: "#1d4ed8" },
  interested:    { bg: "#f5f3ff", color: "#6d28d9" },
  converted:     { bg: "#f0fdf4", color: "#15803d" },
  not_interested:{ bg: "#fef2f2", color: "#b91c1c" },
  paid:          { bg: "#f0fdf4", color: "#15803d" },
  pending:       { bg: "#fef9c3", color: "#854d0e" },
  overdue:       { bg: "#fef2f2", color: "#b91c1c" },
  gym:           { bg: "#eff6ff", color: "#1d4ed8" },
  salon:         { bg: "#fdf4ff", color: "#7e22ce" },
  restaurant:    { bg: "#fff7ed", color: "#c2410c" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = COLORS[status] ?? { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      textTransform: "capitalize",
      whiteSpace: "nowrap",
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
