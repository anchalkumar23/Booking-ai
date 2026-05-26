"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";

interface Call {
  id: string;
  bolna_call_id: string;
  phone: string;
  direction: string;
  purpose: string;
  outcome: string;
  confidence_score: number;
  duration_secs: number;
  transcript: string;
  recording_url: string;
  retry_count: number;
  called_at: string;
}

const PURPOSES = ["reminder", "renewal", "lead"];
const OUTCOMES = ["booked", "busy", "no_answer", "failed", "low_confidence", "not_interested", "transferred"];

const OUTCOME_COLORS: Record<string, string> = {
  booked: "#059669", not_interested: "#dc2626", failed: "#dc2626",
  no_answer: "#d97706", busy: "#d97706", low_confidence: "#7c3aed",
  transferred: "#0284c7",
};

function formatDuration(secs: number): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [transcript, setTranscript] = useState<Call | null>(null);

  const [filterPurpose, setFilterPurpose] = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPurpose) params.set("purpose", filterPurpose);
      if (filterOutcome) params.set("outcome", filterOutcome);
      if (filterPhone) params.set("phone", filterPhone);
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));
      const data = await apiFetch<{ total: number; calls: Call[] }>(`/v1/calls?${params}`);
      setCalls(data.calls);
      setTotal(data.total);
    } catch {
      setToast({ message: "Failed to load call history", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filterPurpose, filterOutcome, filterPhone, offset]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setOffset(0); }, [filterPurpose, filterOutcome, filterPhone]);

  return (
    <div style={{ padding: 32, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>📞 Call History</h1>
          <p style={{ fontSize: 14, color: "#94a3b8" }}>{total} calls total</p>
        </div>
        <button onClick={fetchData} style={outlineBtnStyle}>Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Search by phone…"
          value={filterPhone}
          onChange={e => setFilterPhone(e.target.value)}
          style={selectStyle}
        />
        <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)} style={selectStyle}>
          <option value="">All Purposes</option>
          {PURPOSES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} style={selectStyle}>
          <option value="">All Outcomes</option>
          {OUTCOMES.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
        </select>
        {(filterPurpose || filterOutcome || filterPhone) && (
          <button onClick={() => { setFilterPurpose(""); setFilterOutcome(""); setFilterPhone(""); }} style={{ ...outlineBtnStyle, color: "#ef4444" }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 16, border: "1px solid #edf1f7", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : calls.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>No calls found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #edf1f7" }}>
                {["Phone", "Purpose", "Outcome", "Confidence", "Duration", "Retries", "Time", "Transcript"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafbff" }}>
                  <td style={tdStyle}><b style={{ color: "#0f172a" }}>{c.phone}</b></td>
                  <td style={tdStyle}>
                    <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {c.purpose}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: OUTCOME_COLORS[c.outcome] || "#475569", fontWeight: 600, fontSize: 12 }}>
                      {c.outcome.replace("_", " ")}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: c.confidence_score < 0.7 ? "#dc2626" : "#059669", fontWeight: 600 }}>
                      {c.confidence_score ? `${Math.round(c.confidence_score * 100)}%` : "—"}
                    </span>
                  </td>
                  <td style={tdStyle}>{formatDuration(c.duration_secs)}</td>
                  <td style={tdStyle}>{c.retry_count > 0 ? <span style={{ color: "#d97706", fontWeight: 600 }}>{c.retry_count}</span> : "0"}</td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 11, color: "#94a3b8" }}>{formatTime(c.called_at)}</td>
                  <td style={tdStyle}>
                    {c.transcript ? (
                      <button onClick={() => setTranscript(c)} style={transcriptBtnStyle}>
                        View
                      </button>
                    ) : (
                      <span style={{ color: "#cbd5e1", fontSize: 11 }}>None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))} style={outlineBtnStyle}>
            ← Previous
          </button>
          <span style={{ fontSize: 13, color: "#64748b", alignSelf: "center" }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <button disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)} style={outlineBtnStyle}>
            Next →
          </button>
        </div>
      )}

      {/* Transcript Modal */}
      {transcript && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setTranscript(null)}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 680, width: "100%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Call Transcript
                </h2>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
                  {transcript.phone} · {transcript.purpose} · {formatTime(transcript.called_at)}
                </p>
              </div>
              <button onClick={() => setTranscript(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, background: "#f1f5f9", padding: "3px 10px", borderRadius: 20, color: "#475569" }}>
                Outcome: <b style={{ color: OUTCOME_COLORS[transcript.outcome] }}>{transcript.outcome.replace("_", " ")}</b>
              </span>
              <span style={{ fontSize: 12, background: "#f1f5f9", padding: "3px 10px", borderRadius: 20, color: "#475569" }}>
                Duration: <b>{formatDuration(transcript.duration_secs)}</b>
              </span>
              <span style={{ fontSize: 12, background: "#f1f5f9", padding: "3px 10px", borderRadius: 20, color: "#475569" }}>
                Confidence: <b style={{ color: transcript.confidence_score < 0.7 ? "#dc2626" : "#059669" }}>
                  {Math.round(transcript.confidence_score * 100)}%
                </b>
              </span>
            </div>

            {transcript.recording_url && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Recording</p>
                <audio controls src={transcript.recording_url} style={{ width: "100%" }} />
              </div>
            )}

            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Transcript</p>
              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16, fontSize: 13, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", border: "1px solid #e2e8f0" }}>
                {transcript.transcript || "No transcript available."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: "9px 14px", border: "1.5px solid #e8edf5", borderRadius: 10, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: "#0f172a", background: "white", outline: "none", minWidth: 160 };
const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" as const };
const tdStyle: React.CSSProperties = { padding: "12px 16px", color: "#475569" };
const outlineBtnStyle: React.CSSProperties = { padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e8edf5", background: "white", color: "#475569", fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const transcriptBtnStyle: React.CSSProperties = { padding: "4px 12px", borderRadius: 7, border: "1.5px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontSize: 11, fontWeight: 600, cursor: "pointer" };
