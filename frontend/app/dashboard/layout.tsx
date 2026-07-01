"use client";
import { Sidebar } from "@/components/Sidebar";
import { LocationProvider, useRequireLocation } from "@/lib/location-context";

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useRequireLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center text-muted-foreground">
        Loading location…
      </div>
    );
  }
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocationProvider>
      <div className="flex min-h-screen flex-col bg-secondary/40 lg:flex-row">
        <Sidebar />
        <main className="min-h-screen flex-1">
          <DashboardGuard>{children}</DashboardGuard>
        </main>
      </div>
    </LocationProvider>
  );
}
