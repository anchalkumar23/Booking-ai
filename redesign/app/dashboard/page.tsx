import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { StatCards } from "@/components/dashboard/stat-cards"
import { CallFunnel } from "@/components/dashboard/call-funnel"
import { LeadPipeline } from "@/components/dashboard/lead-pipeline"
import { WhatsAppPerformance } from "@/components/dashboard/whatsapp-performance"
import { AppointmentStats } from "@/components/dashboard/appointment-stats"

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-secondary/40">
      {/* Sidebar: sticky full-height on large screens */}
      <div className="sticky top-0 hidden h-screen lg:block">
        <DashboardSidebar />
      </div>

      <main className="flex-1 px-5 py-8 sm:px-8 lg:px-10">
        <header className="mb-8">
          <h1 className="font-serif text-4xl tracking-tight text-foreground">
            Analytics Dashboard
          </h1>
          <p className="mt-2 text-muted-foreground">
            Real-time overview of your automation performance
          </p>
        </header>

        <StatCards />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CallFunnel />
          <LeadPipeline />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WhatsAppPerformance />
          <AppointmentStats />
        </div>
      </main>
    </div>
  )
}
