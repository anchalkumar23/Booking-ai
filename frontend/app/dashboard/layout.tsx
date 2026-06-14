import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/40 lg:flex-row">
      <Sidebar />
      <main className="min-h-screen flex-1">{children}</main>
    </div>
  );
}
