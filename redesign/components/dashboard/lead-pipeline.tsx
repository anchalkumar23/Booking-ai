import { Target } from "lucide-react"

const stages = [
  { label: "New", value: 1, pct: 22, dot: "bg-slate-400", bar: "bg-slate-400" },
  { label: "Contacted", value: 0, pct: 0, dot: "bg-blue-500", bar: "bg-blue-500" },
  { label: "Interested", value: 0, pct: 0, dot: "bg-fuchsia-500", bar: "bg-fuchsia-500" },
  { label: "Converted", value: 0, pct: 0, dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { label: "Not Interested", value: 0, pct: 0, dot: "bg-rose-500", bar: "bg-rose-500" },
]

export function LeadPipeline() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-fuchsia-500" strokeWidth={2} />
        <h2 className="text-base font-semibold text-foreground">Lead Pipeline</h2>
      </div>

      <ul className="mt-5 space-y-4">
        {stages.map((stage) => (
          <li key={stage.label} className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dot}`} />
            <span className="w-28 shrink-0 text-sm text-muted-foreground">
              {stage.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${stage.bar}`}
                style={{ width: `${stage.pct}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-semibold text-foreground">
              {stage.value}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          Conversion rate: <span className="font-semibold text-emerald-500">0%</span>
        </p>
      </div>
    </div>
  )
}
