import { MessageCircle, Send, CheckCheck, Eye, Reply, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Row = {
  label: string
  value: string
  icon: LucideIcon
  iconClass: string
  valueClass: string
}

const rows: Row[] = [
  { label: "Sent", value: "9", icon: Send, iconClass: "text-blue-500", valueClass: "text-foreground" },
  { label: "Delivered", value: "0 (0%)", icon: CheckCheck, iconClass: "text-emerald-500", valueClass: "text-foreground" },
  { label: "Read", value: "0 (0%)", icon: Eye, iconClass: "text-slate-500", valueClass: "text-foreground" },
  { label: "Replied", value: "0 (0%)", icon: Reply, iconClass: "text-fuchsia-500", valueClass: "text-foreground" },
  { label: "Failed", value: "0", icon: XCircle, iconClass: "text-rose-500", valueClass: "text-foreground" },
]

export function WhatsAppPerformance() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-emerald-500" strokeWidth={2} />
        <h2 className="text-base font-semibold text-foreground">WhatsApp Performance</h2>
      </div>

      <ul className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-2.5">
              <row.icon className={`h-4 w-4 ${row.iconClass}`} strokeWidth={2} />
              <span className="text-sm text-muted-foreground">{row.label}</span>
            </div>
            <span className={`text-sm font-semibold ${row.valueClass}`}>{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
