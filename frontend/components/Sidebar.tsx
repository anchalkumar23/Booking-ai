"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  CreditCard,
  PhoneCall,
  Target,
  Megaphone,
  MessageCircle,
  Users,
  UserCog,
  MapPin,
  LogOut,
  Menu,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { useActiveLocation } from "@/lib/location-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/dashboard/appointments", icon: CalendarDays, label: "Appointments" },
  { href: "/dashboard/memberships", icon: CreditCard, label: "Memberships" },
  { href: "/dashboard/calls", icon: PhoneCall, label: "Call History" },
  { href: "/dashboard/leads", icon: Target, label: "Leads" },
  { href: "/dashboard/campaigns", icon: Megaphone, label: "Campaigns" },
  { href: "/dashboard/inbox", icon: MessageCircle, label: "WhatsApp Inbox" },
  { href: "/dashboard/customers", icon: Users, label: "Customers" },
  { href: "/dashboard/staff", icon: UserCog, label: "Staff" },
  { href: "/dashboard/locations", icon: MapPin, label: "Locations" },
];

const TYPE_ICONS: Record<string, string> = { gym: "🏋️", salon: "💇", restaurant: "🍽️" };

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();
  const { activeLocation, switchLocation } = useActiveLocation();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-[oklch(0.22_0.03_265)] via-[oklch(0.16_0.02_265)] to-[oklch(0.12_0.04_280)] text-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400 text-slate-900">
          <span className="font-serif text-lg font-bold leading-none">D</span>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Dusk AI</p>
          <p className="text-xs text-white/50">Admin Dashboard</p>
        </div>
      </div>

      {activeLocation && (
        <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{TYPE_ICONS[activeLocation.type] || "🏢"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{activeLocation.name}</p>
              <p className="truncate text-[10px] text-white/50">{activeLocation.city}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={switchLocation}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] font-medium text-white/70 hover:bg-white/15 hover:text-white"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Switch location
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 hidden h-screen lg:block">
        <SidebarContent pathname={pathname} />
      </div>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-emerald-400 text-slate-900">
            <span className="font-serif text-sm font-bold leading-none">D</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Dusk AI</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
