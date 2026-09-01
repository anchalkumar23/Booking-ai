"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/lib/location-context";

interface Convo {
  phone: string; name: string | null; last_body: string;
  last_direction: string; last_at: string | null; within_window: boolean;
}
interface Msg {
  direction: string; type: string; template_name: string | null;
  body: string; status: string; sent_at: string | null;
}
interface Thread {
  phone: string; name: string | null; within_window: boolean; messages: Msg[];
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function InboxPage() {
  const { activeLocation } = useActiveLocation();
  const locationId = activeLocation?.id ?? "";
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConvos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ conversations: Convo[] }>("/v1/inbox/conversations");
      setConvos(r.conversations);
      if (!active && r.conversations.length) setActive(r.conversations[0].phone);
    } catch { setToast({ message: "Failed to load conversations", type: "error" }); }
    finally { setLoading(false); }
  }, [active]);

  const loadThread = useCallback(async (phone: string) => {
    try {
      setThread(await apiFetch<Thread>(`/v1/inbox/conversations/${encodeURIComponent(phone)}`));
    } catch { setToast({ message: "Failed to load messages", type: "error" }); }
  }, []);

  useEffect(() => { loadConvos(); }, [loadConvos]);
  useEffect(() => { if (active) loadThread(active); }, [active, loadThread]);
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

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">💬 WhatsApp Inbox</h1>
          <p className="mt-2 text-muted-foreground">Conversations with {activeLocation?.name}</p>
        </div>
        <Button variant="secondary" onClick={() => { loadConvos(); if (active) loadThread(active); }}>Refresh</Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : convos.length === 0 ? (
            <div className="py-12 px-4 text-center text-sm text-muted-foreground">No conversations yet. They appear here once customers message your WhatsApp number.</div>
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
                <span className="truncate text-xs text-muted-foreground">
                  {c.last_direction === "outbound" ? "You: " : ""}{c.last_body}
                </span>
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
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{thread.name || thread.phone}</p>
                <p className="text-xs text-muted-foreground">{thread.phone}</p>
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
                  <div className="flex gap-2">
                    <Input
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      placeholder="Type a reply…"
                    />
                    <Button onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? "…" : "Send"}</Button>
                  </div>
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
    </div>
  );
}
