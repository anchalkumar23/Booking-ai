"use client";
import { useState, useEffect } from "react";
import { apiFetch, HttpError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface LocationOption { id: string; name: string; city: string; type: string; }
interface Appointment { id: string; customer_name: string; service: string; scheduled_at: string; status: string; }
interface Task { type: string; title: string; scheduled_at: string; }
interface CallSummary {
  id: string; phone: string; purpose: string; outcome: string | null;
  summary: string | null; transcript: string | null; called_at: string | null;
}
interface Overview {
  location: { id: string; name: string; type: string; city: string };
  today_appointments: Appointment[];
  upcoming_tasks: Task[];
  recent_calls: CallSummary[];
}

import { Dumbbell, Scissors, UtensilsCrossed, Building2, type LucideIcon } from "lucide-react";
const TYPE_ICON: Record<string, LucideIcon> = { gym: Dumbbell, salon: Scissors, restaurant: UtensilsCrossed };
function TypeIcon({ type }: { type: string }) {
  const Icon = TYPE_ICON[type] || Building2;
  return <Icon className="h-5 w-5" strokeWidth={1.75} />;
}
const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function PortalPage() {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [password, setPassword] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<LocationOption[]>("/v1/portal/locations").then(setLocations).catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<Overview>("/v1/portal/overview", {
        method: "POST",
        body: JSON.stringify({ location_id: locationId, password }),
      });
      setOverview(data);
    } catch (err) {
      if (err instanceof HttpError) setError(err.detail.message);
      else setError("Unable to load portal. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!overview) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-3xl tracking-tight text-foreground">Location Portal</h1>
          <p className="mt-2 text-muted-foreground">Sign in with your location password to view today&apos;s tasks and calls.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-semibold text-foreground">Location</Label>
              <select id="location" value={locationId} onChange={e => setLocationId(e.target.value)} required className={selectClass}>
                <option value="">Select your location…</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} — {l.city}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">Location Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Enter location password" className="h-12 rounded-xl" />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
            )}

            <Button type="submit" disabled={loading || !locationId || !password} className="h-12 w-full rounded-xl text-sm font-semibold">
              {loading ? "Signing in…" : "View Dashboard"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground"><TypeIcon type={overview.location.type} /></span>
            {overview.location.name}
          </h1>
          <p className="mt-2 text-muted-foreground">{overview.location.city}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOverview(null)}>Sign out</Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">Upcoming Tasks</h2>
            {overview.upcoming_tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due in the next 2 hours.</p>
            ) : (
              <div className="space-y-2.5">
                {overview.upcoming_tasks.map((t, i) => (
                  <div key={i} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground">{t.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{new Date(t.scheduled_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">Today&apos;s Appointments</h2>
            {overview.today_appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments scheduled today.</p>
            ) : (
              <div className="space-y-2.5">
                {overview.today_appointments.map(a => (
                  <div key={a.id} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{a.customer_name} — {a.service}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{new Date(a.scheduled_at).toLocaleString()}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">Recent Calls</h2>
            {overview.recent_calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calls yet.</p>
            ) : (
              <div className="space-y-2.5">
                {overview.recent_calls.map(c => (
                  <div key={c.id} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{c.phone}</span>
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                        {c.outcome ? c.outcome.replace("_", " ") : "pending"}
                      </span>
                    </div>
                    <p className="mb-1.5 text-xs text-muted-foreground">{c.called_at ? new Date(c.called_at).toLocaleString() : ""} · {c.purpose}</p>
                    {c.summary && (
                      <p className="rounded-lg bg-indigo-50 px-2.5 py-2 text-xs text-indigo-700">{c.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
