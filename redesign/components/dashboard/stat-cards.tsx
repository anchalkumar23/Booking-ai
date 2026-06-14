import { PhoneCall, CalendarDays, Target, MessageCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Stat = {
  label: string
  value: string
  sub: string
  meta: string
  icon: LucideIcon
  iconClass: string
}

const stats: Stat[] = [
  {
    label: "Total Calls",
    value: "0",
    sub: "Avg 0s duration",
    meta: "0 converted",
    icon: PhoneCall,
    iconClass: "bg-rose-50 text-rose-500",
  },
  {
    label: "Appointments",
    value: "0",
    sub: "0 upcoming",
    meta: "0% completion rate",
    icon: CalendarDays,
    iconClass: "bg-blue-50 text-blue-500",
  },
  {
    label: "Leads",
    value: "1",
    sub: "0 interested",
    meta: "0% conversion rate",
    icon: Target,
    iconClass: "bg-fuchsia-50 text-fuchsia-500",
  },
  {
    label: "WhatsApp",
    value: "9",
    sub: "0 replies received",
    meta: "0% delivery rate",
    icon: MessageCircle,
    iconClass: "bg-emerald-50 text-emerald-500",
  },
]

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconClass}`}
            >
              <stat.icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-4 font-serif text-4xl tracking-tight text-foreground">
            {stat.value}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{stat.sub}</p>
          <p className="mt-1 text-xs font-medium text-rose-500">{stat.meta}</p>
        </div>
      ))}
    </div>
  )
}
