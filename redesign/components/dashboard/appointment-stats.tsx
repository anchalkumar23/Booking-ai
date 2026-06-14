import {
  CalendarCheck,
  CalendarClock,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  BellRing,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Row = {
  label: string
  value: string
  icon: LucideIcon
  iconClass: string
  valueClass: string
}

const rows: Row[] = [
  { label: "Total Booked", value: "0", icon: CalendarCheck, iconClass: "text-blue-500", valueClass: "text-blue-500" },
  { label: "Upcoming", value: "0", icon: Clock, iconClass: "text-slate-500", valueClass: "text-blue-500" },
  { label: "Completed", value: "0", icon: CheckCircle2, iconClass: "text-emerald-500", valueClass: "text-emerald-500" },
  { label: "Cancelled", value: "0", icon: XCircle, iconClass: "text-rose-500", valueClass: "text-rose-500" },
  { label: "No Show", value: "0", icon: Ban, iconClass: "text-rose-500", valueClass: "text-rose-500" },
  { label: "Reminders Sent", value: "0", icon: BellRing, iconClass: "text-amber-500", valueClass: "text-amber-500" },
]

export function AppointmentStats() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-blue-500" strokeWidth={2} />
        <h2 className="text-base font-semibold text-foreground">Appointment Stats</h2>
      </div>

      <ul className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5">
              <row.icon className={`h-4 w-4 ${row.iconClass}`} strokeWidth={2} />
              <span className="text-sm text-muted-foreground">{row.label}</span>
            </div>
            <span className={`text-sm font-semibold ${row.valueClass}`}>{row.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Completion
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-500">0%</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            No-Show
          </p>
          <p className="mt-1 text-lg font-semibold text-rose-500">0%</p>
        </div>
      </div>
    </div>
  )
}
