"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useActiveLocation } from "@/lib/location-context";
import { PhoneCall, CalendarDays, Target, MessageCircle, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Phone numbers deep-link to their WhatsApp Inbox conversation.
function PhoneLink({ phone }: { phone: string }) {
  return (
    <Link
      href={`/dashboard/inbox?phone=${encodeURIComponent(phone)}`}
      className="text-sm font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
    >
      {phone}
    </Link>
  );
}

interface CallStats {
  initiated: number; connected: number; completed: number;
  converted: number; no_answer: number; not_interested: number;
  low_confidence: number; avg_duration_secs: number;
}
interface WhatsAppStats {
  sent: number; delivered: number; read: number; replied: number;
  failed: number; delivery_rate: number; read_rate: number; reply_rate: number;
}
interface AppointmentStats {
  total: number; scheduled: number; completed: number;
  cancelled: number; no_show: number; completion_rate: number;
  no_show_rate: number; reminders_sent: number;
}
interface LeadStats {
  total: number; new: number; contacted: number; interested: number;
  converted: number; not_interested: number; conversion_rate: number;
}
interface Overview {
  calls: CallStats;
  whatsapp: WhatsAppStats;
  appointments: AppointmentStats;
  leads: LeadStats;
}

interface UpcomingTask { type: string; title: string; scheduled_at: string; }
interface RecentCall {
  id: string; phone: string; purpose: string; outcome: string | null;
  summary: string | null; called_at: string | null;
}
interface RecentMessage {
  id: string; phone: string; template_name: string | null;
  body: string; status: string; sent_at: string | null;
}
interface Activity {
  upcoming_tasks: UpcomingTask[];
  recent_calls: RecentCall[];
  recent_messages: RecentMessage[];
}

function StatCard({ label, value, sub, meta, metaGood, icon: Icon, iconClass }: {
  label: string; value: string | number; sub: string; meta: string; metaGood: boolean;
  icon: LucideIcon; iconClass: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
      <p className="mt-4 font-serif text-4xl tracking-tight text-foreground">{value}</p>
      <p className="mt-3 text-xs text-muted-foreground">{sub}</p>
      <p className={`mt-1 text-xs font-medium ${metaGood ? "text-emerald-600" : "text-rose-500"}`}>{meta}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const { activeLocation } = useActiveLocation();
  const locationId = activeLocation?.id ?? "";
  const [data, setData] = useState<Overview | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const params = `?location_id=${locationId}`;
      const [result, act] = await Promise.all([
        apiFetch<Overview>(`/v1/analytics/overview${params}`),
        apiFetch<Activity>(`/v1/analytics/activity${params}`),
      ]);
      setData(result);
      setActivity(act);
    } catch {
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const funnelMax = data?.calls.initiated || 1;

  const funnelSteps = data ? [
    { label: "Initiated", count: data.calls.initiated, color: "bg-violet-400" },
    { label: "Connected", count: data.calls.connected, color: "bg-blue-400" },
    { label: "Completed", count: data.calls.completed, color: "bg-emerald-400" },
    { label: "Converted", count: data.calls.converted, color: "bg-emerald-600" },
  ] : [];

  const pipeline = data ? [
    { label: "New", count: data.leads.new, color: "bg-slate-400" },
    { label: "Contacted", count: data.leads.contacted, color: "bg-blue-400" },
    { label: "Interested", count: data.leads.interested, color: "bg-violet-400" },
    { label: "Converted", count: data.leads.converted, color: "bg-emerald-500" },
    { label: "Not Interested", count: data.leads.not_interested, color: "bg-rose-400" },
  ] : [];

  const pipelineMax = data?.leads.total || 1;

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">Analytics Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Real-time overview of your automation performance</p>
      </header>

      {loading && <div className="text-muted-foreground">Loading analytics…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Calls" value={data.calls.initiated}
              sub={`Avg ${data.calls.avg_duration_secs}s duration`}
              icon={PhoneCall} iconClass="bg-rose-50 text-rose-500"
              meta={`${data.calls.converted} converted`} metaGood={data.calls.converted > 0} />
            <StatCard label="Appointments" value={data.appointments.total}
              sub={`${data.appointments.scheduled} upcoming`}
              icon={CalendarDays} iconClass="bg-blue-50 text-blue-500"
              meta={`${data.appointments.completion_rate}% completion rate`}
              metaGood={data.appointments.completion_rate >= 70} />
            <StatCard label="Leads" value={data.leads.total}
              sub={`${data.leads.interested} interested`}
              icon={Target} iconClass="bg-fuchsia-50 text-fuchsia-500"
              meta={`${data.leads.conversion_rate}% conversion rate`}
              metaGood={data.leads.conversion_rate >= 10} />
            <StatCard label="WhatsApp" value={data.whatsapp.sent}
              sub={`${data.whatsapp.replied} replies received`}
              icon={MessageCircle} iconClass="bg-emerald-50 text-emerald-500"
              meta={`${data.whatsapp.delivery_rate}% delivery rate`}
              metaGood={data.whatsapp.delivery_rate >= 80} />
          </div>

          {/* Activity: what's next, and recent calls & messages.
              items-start keeps each card at its natural height so a long list
              never stretches the row and leaves the others padded with blank space. */}
          {activity && (
            <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Up next</h2>
                  {activity.upcoming_tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing due in the next 2 hours.</p>
                  ) : (
                    <div className="max-h-80 space-y-2.5 overflow-y-auto">
                      {activity.upcoming_tasks.map((t, i) => (
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
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent calls</h2>
                  {activity.recent_calls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No calls yet.</p>
                  ) : (
                    <div className="max-h-80 space-y-2.5 overflow-y-auto">
                      {activity.recent_calls.map(c => (
                        <div key={c.id} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <PhoneLink phone={c.phone} />
                            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                              {c.outcome ? c.outcome.replace("_", " ") : "pending"}
                            </span>
                          </div>
                          {c.summary && <p className="mt-1 text-xs text-muted-foreground">{c.summary}</p>}
                          <p className="mt-1 text-[11px] text-muted-foreground">{c.called_at ? new Date(c.called_at).toLocaleString() : ""}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent messages</h2>
                  {activity.recent_messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages sent yet.</p>
                  ) : (
                    <div className="max-h-80 space-y-2.5 overflow-y-auto">
                      {activity.recent_messages.map(m => (
                        <div key={m.id} className="rounded-xl bg-secondary/60 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <PhoneLink phone={m.phone} />
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{m.status}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{m.body}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Call Funnel */}
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">Call Funnel</h2>
                <div className="space-y-3">
                  {funnelSteps.map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(count / funnelMax * 100)}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-6 border-t border-border pt-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">NO ANSWER</p>
                    <p className="font-semibold text-rose-500">{data.calls.no_answer}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">NOT INTERESTED</p>
                    <p className="font-semibold text-rose-500">{data.calls.not_interested}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">LOW CONFIDENCE</p>
                    <p className="font-semibold text-amber-500">{data.calls.low_confidence}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lead Pipeline */}
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">Lead Pipeline</h2>
                <div className="space-y-3">
                  {pipeline.map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                      <span className="w-28 shrink-0 text-sm text-muted-foreground">{label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(count / pipelineMax * 100)}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">Conversion rate: </span>
                  <span className="font-semibold text-emerald-600">{data.leads.conversion_rate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp + Appointments row */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">WhatsApp Performance</h2>
                <div className="space-y-2.5">
                  {[
                    { label: "Sent", value: data.whatsapp.sent },
                    { label: "Delivered", value: `${data.whatsapp.delivered} (${data.whatsapp.delivery_rate}%)` },
                    { label: "Read", value: `${data.whatsapp.read} (${data.whatsapp.read_rate}%)` },
                    { label: "Replied", value: `${data.whatsapp.replied} (${data.whatsapp.reply_rate}%)` },
                    { label: "Failed", value: data.whatsapp.failed },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 font-serif text-lg font-semibold tracking-tight">Appointment Stats</h2>
                <div className="space-y-2.5">
                  {[
                    { label: "Total Booked", value: data.appointments.total, color: "text-violet-500" },
                    { label: "Upcoming", value: data.appointments.scheduled, color: "text-blue-500" },
                    { label: "Completed", value: data.appointments.completed, color: "text-emerald-600" },
                    { label: "Cancelled", value: data.appointments.cancelled, color: "text-slate-400" },
                    { label: "No Show", value: data.appointments.no_show, color: "text-rose-500" },
                    { label: "Reminders Sent", value: data.appointments.reminders_sent, color: "text-amber-500" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-6 border-t border-border pt-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">COMPLETION</p>
                    <p className="font-semibold text-emerald-600">{data.appointments.completion_rate}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">NO-SHOW</p>
                    <p className="font-semibold text-rose-500">{data.appointments.no_show_rate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
