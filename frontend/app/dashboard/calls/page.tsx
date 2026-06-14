"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Call {
  id: string;
  bolna_call_id: string;
  phone: string;
  direction: string;
  purpose: string;
  outcome: string | null;
  confidence_score: number;
  duration_secs: number;
  transcript: string;
  summary: string | null;
  recording_url: string;
  retry_count: number;
  called_at: string;
}

const PURPOSES = ["reminder", "renewal", "lead"];
const OUTCOMES = ["booked", "busy", "no_answer", "failed", "low_confidence", "not_interested", "transferred"];

const OUTCOME_COLORS: Record<string, string> = {
  booked: "text-emerald-600", not_interested: "text-rose-600", failed: "text-rose-600",
  no_answer: "text-amber-600", busy: "text-amber-600", low_confidence: "text-violet-600",
  transferred: "text-sky-600",
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

  const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-48";

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">📞 Call History</h1>
          <p className="mt-2 text-muted-foreground">{total} calls total</p>
        </div>
        <Button variant="outline" onClick={fetchData}>Refresh</Button>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          placeholder="Search by phone…"
          value={filterPhone}
          onChange={e => setFilterPhone(e.target.value)}
          className="sm:w-48"
        />
        <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)} className={selectClass}>
          <option value="">All Purposes</option>
          {PURPOSES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
        <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} className={selectClass}>
          <option value="">All Outcomes</option>
          {OUTCOMES.map(o => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
        </select>
        {(filterPurpose || filterOutcome || filterPhone) && (
          <Button variant="outline" onClick={() => { setFilterPurpose(""); setFilterOutcome(""); setFilterPhone(""); }} className="text-rose-500">
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : calls.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No calls found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {["Phone", "Purpose", "Outcome", "Confidence", "Duration", "Retries", "Time", "Transcript"].map(h => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map(c => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3"><span className="font-semibold text-foreground">{c.phone}</span></td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {c.purpose}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${(c.outcome && OUTCOME_COLORS[c.outcome]) || "text-muted-foreground"}`}>
                      {c.outcome ? c.outcome.replace("_", " ") : "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${c.confidence_score < 0.7 ? "text-rose-600" : "text-emerald-600"}`}>
                      {c.confidence_score ? `${Math.round(c.confidence_score * 100)}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDuration(c.duration_secs)}</td>
                  <td className="px-4 py-3">{c.retry_count > 0 ? <span className="font-semibold text-amber-600">{c.retry_count}</span> : "0"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatTime(c.called_at)}</td>
                  <td className="px-4 py-3">
                    {c.transcript ? (
                      <Button size="sm" variant="outline" onClick={() => setTranscript(c)}>View</Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
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
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>
            ← Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <Button variant="outline" disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}>
            Next →
          </Button>
        </div>
      )}

      {/* Transcript Modal */}
      {transcript && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-6"
          onClick={() => setTranscript(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-7 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
                  Call Transcript
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transcript.phone} · {transcript.purpose} · {formatTime(transcript.called_at)}
                </p>
              </div>
              <button onClick={() => setTranscript(null)} className="text-xl text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                Outcome: <b className={transcript.outcome ? OUTCOME_COLORS[transcript.outcome] : undefined}>{transcript.outcome ? transcript.outcome.replace("_", " ") : "pending"}</b>
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                Duration: <b>{formatDuration(transcript.duration_secs)}</b>
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                Confidence: <b className={(transcript.confidence_score ?? 1) < 0.7 ? "text-rose-600" : "text-emerald-600"}>
                  {Math.round((transcript.confidence_score ?? 0) * 100)}%
                </b>
              </span>
            </div>

            {transcript.recording_url && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Recording</p>
                <audio controls src={transcript.recording_url} className="w-full" />
              </div>
            )}

            {transcript.summary && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Summary</p>
                <div className="rounded-xl border border-accent bg-accent/40 p-4 text-sm leading-relaxed text-foreground">
                  {transcript.summary}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Transcript</p>
              <div className="max-h-[360px] overflow-auto rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {transcript.transcript || "No transcript available."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
