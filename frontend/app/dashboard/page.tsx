"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import styles from "./dashboard.module.css";

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

function StatCard({ label, value, sub, icon, iconClass, rate, rateGood }: {
  label: string; value: string | number; sub?: string;
  icon: string; iconClass: string; rate?: string; rateGood?: boolean;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardHeader}>
        <span className={styles.statCardLabel}>{label}</span>
        <div className={`${styles.statCardIcon} ${iconClass}`}>{icon}</div>
      </div>
      <div className={styles.statCardValue}>{value}</div>
      {sub && <div className={styles.statCardSub}>{sub}</div>}
      {rate && (
        <div className={`${styles.statCardRate} ${rateGood ? styles.rateGood : styles.rateBad}`}>
          {rate}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<Overview>("/v1/analytics/overview");
      setData(result);
    } catch {
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const funnelMax = data?.calls.initiated || 1;

  const funnelSteps = data ? [
    { label: "Initiated", count: data.calls.initiated, color: "#a78bfa" },
    { label: "Connected", count: data.calls.connected, color: "#60a5fa" },
    { label: "Completed", count: data.calls.completed, color: "#34d399" },
    { label: "Converted", count: data.calls.converted, color: "#10b981" },
  ] : [];

  const pipeline = data ? [
    { label: "New", count: data.leads.new, color: "#94a3b8" },
    { label: "Contacted", count: data.leads.contacted, color: "#60a5fa" },
    { label: "Interested", count: data.leads.interested, color: "#a78bfa" },
    { label: "Converted", count: data.leads.converted, color: "#10b981" },
    { label: "Not Interested", count: data.leads.not_interested, color: "#f87171" },
  ] : [];

  const pipelineMax = data?.leads.total || 1;

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Analytics Dashboard</h1>
          <p className={styles.pageSubtitle}>Real-time overview of your automation performance</p>
        </div>

        {loading && <div className={styles.loading}>Loading analytics…</div>}
        {error && <div className={styles.error}>{error}</div>}

        {data && (
          <>
            {/* Top stat cards */}
            <div className={styles.statsGrid}>
              <StatCard label="Total Calls" value={data.calls.initiated}
                sub={`Avg ${data.calls.avg_duration_secs}s duration`}
                icon="📞" iconClass={styles.iconPurple}
                rate={`${data.calls.converted} converted`} rateGood={data.calls.converted > 0} />
              <StatCard label="Appointments" value={data.appointments.total}
                sub={`${data.appointments.scheduled} upcoming`}
                icon="📅" iconClass={styles.iconBlue}
                rate={`${data.appointments.completion_rate}% completion rate`}
                rateGood={data.appointments.completion_rate >= 70} />
              <StatCard label="Leads" value={data.leads.total}
                sub={`${data.leads.interested} interested`}
                icon="🎯" iconClass={styles.iconPink}
                rate={`${data.leads.conversion_rate}% conversion rate`}
                rateGood={data.leads.conversion_rate >= 10} />
              <StatCard label="WhatsApp" value={data.whatsapp.sent}
                sub={`${data.whatsapp.replied} replies received`}
                icon="💬" iconClass={styles.iconGreen}
                rate={`${data.whatsapp.delivery_rate}% delivery rate`}
                rateGood={data.whatsapp.delivery_rate >= 80} />
            </div>

            <div className={styles.twoCol}>
              {/* Call Funnel */}
              <div className={styles.card}>
                <div className={styles.sectionTitle}>📞 Call Funnel</div>
                {funnelSteps.map(({ label, count, color }) => (
                  <div key={label} className={styles.funnelItem}>
                    <span className={styles.funnelLabel}>{label}</span>
                    <div className={styles.funnelBarWrap}>
                      <div
                        className={styles.funnelBar}
                        style={{
                          width: `${Math.round(count / funnelMax * 100)}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <span className={styles.funnelCount}>{count}</span>
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "flex", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>NO ANSWER</div>
                    <div style={{ fontWeight: 700, color: "#f87171" }}>{data.calls.no_answer}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>NOT INTERESTED</div>
                    <div style={{ fontWeight: 700, color: "#f87171" }}>{data.calls.not_interested}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>LOW CONFIDENCE</div>
                    <div style={{ fontWeight: 700, color: "#f59e0b" }}>{data.calls.low_confidence}</div>
                  </div>
                </div>
              </div>

              {/* Lead Pipeline */}
              <div className={styles.card}>
                <div className={styles.sectionTitle}>🎯 Lead Pipeline</div>
                {pipeline.map(({ label, count, color }) => (
                  <div key={label} className={styles.pipelineRow}>
                    <div className={styles.pipelineDot} style={{ background: color }} />
                    <span className={styles.pipelineLabel}>{label}</span>
                    <div className={styles.pipelineBar}>
                      <div
                        className={styles.pipelineBarFill}
                        style={{
                          width: `${Math.round(count / pipelineMax * 100)}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <span className={styles.pipelineCount}>{count}</span>
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>Conversion rate: </span>
                  <span style={{ fontWeight: 700, color: "#10b981" }}>{data.leads.conversion_rate}%</span>
                </div>
              </div>
            </div>

            {/* WhatsApp + Appointments row */}
            <div className={styles.twoCol}>
              {/* WhatsApp Stats */}
              <div className={styles.card}>
                <div className={styles.sectionTitle}>💬 WhatsApp Performance</div>
                {[
                  { label: "📤 Sent", value: data.whatsapp.sent },
                  { label: "✅ Delivered", value: `${data.whatsapp.delivered} (${data.whatsapp.delivery_rate}%)` },
                  { label: "👁 Read", value: `${data.whatsapp.read} (${data.whatsapp.read_rate}%)` },
                  { label: "💬 Replied", value: `${data.whatsapp.replied} (${data.whatsapp.reply_rate}%)` },
                  { label: "❌ Failed", value: data.whatsapp.failed },
                ].map(({ label, value }) => (
                  <div key={label} className={styles.waRateItem}>
                    <span className={styles.waRateLabel}>{label}</span>
                    <span className={styles.waRateValue}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Appointment Stats */}
              <div className={styles.card}>
                <div className={styles.sectionTitle}>📅 Appointment Stats</div>
                {[
                  { label: "📋 Total Booked", value: data.appointments.total, color: "#a78bfa" },
                  { label: "⏳ Upcoming", value: data.appointments.scheduled, color: "#60a5fa" },
                  { label: "✅ Completed", value: data.appointments.completed, color: "#10b981" },
                  { label: "❌ Cancelled", value: data.appointments.cancelled, color: "#94a3b8" },
                  { label: "🚫 No Show", value: data.appointments.no_show, color: "#f87171" },
                  { label: "🔔 Reminders Sent", value: data.appointments.reminders_sent, color: "#f59e0b" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={styles.waRateItem}>
                    <span className={styles.waRateLabel}>{label}</span>
                    <span className={styles.waRateValue} style={{ color }}>{value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9", display: "flex", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>COMPLETION</div>
                    <div style={{ fontWeight: 700, color: "#10b981" }}>{data.appointments.completion_rate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>NO-SHOW</div>
                    <div style={{ fontWeight: 700, color: "#f87171" }}>{data.appointments.no_show_rate}%</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
