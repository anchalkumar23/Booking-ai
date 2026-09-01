"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/lib/location-context";

interface Convo {
  phone: string; name: string | null; last_body: string;
  last_direction: string; last_at: string | null; within_window: boolean; status: string;
}
interface Msg {
  direction: string; type: string; template_name: string | null;
  body: string; status: string; sent_at: string | null;
}
interface Thread {
  phone: string; name: string | null; status: string; within_window: boolean; messages: Msg[];
}
interface Canned { id: string; title: string; body: string; }

function timeAgo(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const FILTERS = [["", "All"], ["open", "Open"], ["resolved", "Resolved"]];

export default function InboxPage() {
  const { activeLocation } = useActiveLocation();
  const locationId = activeLocation?.id ?? "";
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [canned, setCanned] = useState<Canned[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [newCanned, setNewCanned] = useState({ title: "", body: "" });

  const loadConvos = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const r = await apiFetch<{ conversations: Convo[] }>(`/v1/inbox/conversations${qs}`);
      setConvos(r.conversations);
      if (r.conversations.length && !r.conversations.find(c => c.phone === active)) {
        setActive(r.conversations[0].phone);
      }
    } catch { setToast({ message: "Failed to load conversations", type: "error" }); }
    finally { setLoading(false); }
  }, [statusFilter, active]);

  const loadThread = useCallback(async (phone: string) => {
    try { setThread(await apiFetch<Thread>(`/v1/inbox/conversations/${encodeURIComponent(phone)}`)); }
    catch { setToast({ message: "Failed to load messages", type: "error" }); }
  }, []);

  const loadCanned = useCallback(async () => {
    if (!locationId) return;
    try { setCanned((await apiFetch<{ canned: Canned[] }>(`/v1/inbox/canned?location_id=${locationId}`)).canned); }
    catch { /* non-fatal */ }
  }, [locationId]);

  useEffect(() => { loadConvos(); }, [loadConvos]);
  useEffect(() => { if (active) loadThread(active); }, [active, loadThread]);
  useEffect(() => { loadCanned(); }, [loadCanned]);
  useEffect(() => { bottomRef.current?.scrollIntoView(); }, [thread]);

  async function sendReply() {
    if (!reply.trim() || !active || !locationId) return;
    setSending(true);
    try {
      await apiFetch(`/v1/inbox/conversations/${encodeURIComponent(active)}/reply`, {
        method: "POST", body: JSON.stringify({ location_id: locationId, text: reply }),
      });
      setReply("");
      await loadThread(active);
      loadConvos();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to send", type: "error" });
    } finally { setSending(false); }
  }

  async function setStatus(next: string) {
    if (!active) return;
    try {
      await apiFetch(`/v1/inbox/conversations/${encodeURIComponent(active)}/status`, {
        method: "POST", body: JSON.stringify({ status: next }),
      });
      await loadThread(active);
      loadConvos();
    } catch { setToast({ message: "Failed to update status", type: "error" }); }
  }

  async function addCanned() {
    if (!newCanned.title.trim() || !newCanned.body.trim()) return;
    try {
      await apiFetch("/v1/inbox/canned", { method: "POST", body: JSON.stringify({ ...newCanned, location_id: locationId }) });
      setNewCanned({ title: "", body: "" });
      loadCanned();
    } catch { setToast({ message: "Failed to save quick reply", type: "error" }); }
  }
  async function deleteCanned(id: string) {
    try { await apiFetch(`/v1/inbox/canned/${id}`, { method: "DELETE" }); loadCanned(); }
    catch { setToast({ message: "Failed to delete", type: "error" }); }
  }

  function insertCanned(body: string) {
    setReply(prev => (prev.trim() ? `${prev} ${body}` : body));
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">💬 WhatsApp Inbox</h1>
          <p className="mt-2 text-muted-foreground">Conversations with {activeLocation?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCanned(true)}>Quick replies</Button>
          <Button variant="secondary" onClick={() => { loadConvos(); if (active) loadThread(active); }}>Refresh</Button>
        </div>
      </header>

      {/* status filter */}
      <div className="mb-4 flex gap-1.5">
        {FILTERS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === val ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : convos.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No conversations here yet.</div>
          ) : (
            convos.map(c => (
              <button
                key={c.phone}
                onClick={() => setActive(c.phone)}
                className={`flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 ${active === c.phone ? "bg-secondary/60" : "hover:bg-secondary/30"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{c.name || c.phone}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.last_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.status === "resolved" && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">resolved</span>}
                  <span className="truncate text-xs text-muted-foreground">
                    {c.last_direction === "outbound" ? "You: " : ""}{c.last_body}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="flex max-h-[70vh] flex-col rounded-2xl border border-border bg-card shadow-sm">
          {!thread ? (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">Select a conversation</div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{thread.name || thread.phone}</p>
                  <p className="text-xs text-muted-foreground">{thread.phone}</p>
                </div>
                {thread.status === "resolved" ? (
                  <Button size="sm" variant="outline" onClick={() => setStatus("open")}>Reopen</Button>
                ) : (
                  <Button size="sm" variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => setStatus("resolved")}>Mark resolved</Button>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {thread.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "outbound" ? "bg-emerald-100 text-emerald-950" : "bg-secondary text-foreground"}`}>
                      {m.type === "template" && m.template_name && (
                        <span className="mb-0.5 block text-[10px] font-medium text-muted-foreground">📋 {m.template_name}</span>
                      )}
                      <span className="whitespace-pre-wrap">{m.body}</span>
                      <span className="mt-0.5 block text-right text-[10px] text-muted-foreground">
                        {timeAgo(m.sent_at)}{m.direction === "outbound" ? ` · ${m.status}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-border p-3">
                {thread.within_window ? (
                  <>
                    {canned.length > 0 && (
                      <select
                        value=""
                        onChange={e => { if (e.target.value) { insertCanned(e.target.value); e.target.value = ""; } }}
                        className="mb-2 h-9 w-full rounded-xl border border-input bg-transparent px-3 text-xs outline-none focus-visible:border-ring"
                      >
                        <option value="">Insert a quick reply…</option>
                        {canned.map(c => <option key={c.id} value={c.body}>{c.title}</option>)}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        placeholder="Type a reply…"
                      />
                      <Button onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? "…" : "Send"}</Button>
                    </div>
                  </>
                ) : (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
                    The 24-hour free-reply window is closed. To message this contact now, send an approved template via <b>Campaigns</b>.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showCanned && (
        <Modal title="Quick Replies" onClose={() => setShowCanned(false)}>
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-muted-foreground">Save answers you send often. Insert them in one click from the reply box.</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {canned.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quick replies yet.</p>
              ) : canned.map(c => (
                <div key={c.id} className="flex items-start justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.body}</p>
                  </div>
                  <button onClick={() => deleteCanned(c.id)} className="shrink-0 text-xs text-rose-600 hover:underline">Delete</button>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <Input value={newCanned.title} onChange={e => setNewCanned({ ...newCanned, title: e.target.value })} placeholder="Title (e.g. Timings)" />
              <textarea
                value={newCanned.body}
                onChange={e => setNewCanned({ ...newCanned, body: e.target.value })}
                rows={2}
                placeholder="Message text"
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              />
              <Button onClick={addCanned} disabled={!newCanned.title.trim() || !newCanned.body.trim()} className="w-full">Add quick reply</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
