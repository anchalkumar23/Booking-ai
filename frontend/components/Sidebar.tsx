"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import styles from "./Sidebar.module.css";

const NAV = [
  { href: "/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/dashboard/appointments", icon: "📅", label: "Appointments" },
  { href: "/dashboard/memberships", icon: "💳", label: "Memberships" },
  { href: "/dashboard/calls", icon: "📞", label: "Call History" },
  { href: "/dashboard/leads", icon: "🎯", label: "Leads" },
  { href: "/dashboard/customers", icon: "👥", label: "Customers" },
  { href: "/dashboard/staff", icon: "👤", label: "Staff" },
  { href: "/dashboard/locations", icon: "🏢", label: "Locations" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandIcon}>B</div>
        <div>
          <div className={styles.brandName}>Booking AI</div>
          <div className={styles.brandSub}>Admin Dashboard</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ href, icon, label }) => {
          const active = href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${active ? styles.active : ""}`}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <button className={styles.logoutBtn} onClick={handleLogout}>
        <span>⬡</span> Sign Out
      </button>
    </aside>
  );
}
