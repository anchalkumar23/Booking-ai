"use client"

import {
  LayoutGrid,
  CalendarDays,
  CreditCard,
  PhoneCall,
  Target,
  Users,
  UserCog,
  MapPin,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Appointments", icon: CalendarDays },
  { label: "Memberships", icon: CreditCard },
  { label: "Call History", icon: PhoneCall },
  { label: "Leads", icon: Target },
  { label: "Customers", icon: Users },
  { label: "Staff", icon: UserCog },
  { label: "Locations", icon: MapPin },
]

export function DashboardSidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-[oklch(0.22_0.03_265)] via-[oklch(0.16_0.02_265)] to-[oklch(0.12_0.04_280)] text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400 text-slate-900">
          <span className="font-serif text-lg font-bold leading-none">B</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Booking AI</p>
          <p className="text-xs text-white/50">Admin Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => (
          <a
            key={item.label}
            href="#"
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              item.active
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon className="h-4 w-4" strokeWidth={1.75} />
            {item.label}
          </a>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
