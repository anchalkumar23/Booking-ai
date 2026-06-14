import { PhoneCall } from "lucide-react"

const steps = [
  { label: "Initiated", value: 0, pct: 100 },
  { label: "Connected", value: 0, pct: 78 },
  { label: "Completed", value: 0, pct: 56 },
  { label: "Converted", value: 0, pct: 32 },
]

const outcomes = [
  { label: "No Answer", value: 0, className: "text-rose-500" },
  { label: "Not Interested", value: 0, className: "text-rose-500" },
  { label: "Low Confidence", value: 0, className: "text-amber-500" },
]

export function CallFunnel() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <PhoneCall className="h-4 w-4 text-rose-500" strokeWidth={2} />
        <h2 className="text-base font-semibold text-foreground">Call Funnel</h2>
      </div>

      <ul className="mt-5 space-y-4">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-4">
            <span className="w-24 shrink-0 text-sm text-muted-foreground">
              {step.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-foreground/15"
                style={{ width: `${step.pct}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-semibold text-foreground">
              {step.value}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border pt-5">
        {outcomes.map((outcome) => (
          <div key={outcome.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {outcome.label}
            </p>
            <p className={`mt-1 text-lg font-semibold ${outcome.className}`}>
              {outcome.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
