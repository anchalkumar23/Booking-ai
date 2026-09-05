"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/lib/location-context";

interface Campaign {
  id: string; name: string; message: string; audience: string; channel: string;
  tier: string | null; expiring_days: number | null; lead_status: string | null;
  wa_template: string | null;
  status: string; total_targets: number; calls_queued: number; messages_queued: number; skipped: number;
  created_at: string;
}
interface WaTemplate { name: string; language: string; category?: string; variables: number; body?: string; }
interface AllTemplate extends WaTemplate { status: string; rejected_reason?: string | null; }
interface Stats {
  id: string; name: string; channel: string; total_targets: number; queued: number;
  whatsapp?: { sent: number; delivered: number; read: number; failed: number };
  calls?: { total: number; outcomes: Record<string, number> };
}

const AUDIENCES = [
  { value: "all_customers", label: "All customers at this location" },
  { value: "members_by_tier", label: "Members by tier" },
  { value: "expiring_members", label: "Expiring / lapsed members (win-back)" },
  { value: "leads", label: "Past leads" },
];
const LEAD_STATUSES = ["new", "contacted", "interested", "converted", "not_interested"];

const AUDIENCE_LABEL: Record<string, string> = {
  ...Object.fromEntries(AUDIENCES.map(a => [a.value, a.label])),
  uploaded_list: "Uploaded CSV / Excel list",
};

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const TEMPLATE_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta_IN", label: "Tamil" },
];

function countTemplateVars(body: string): number {
  const nums = [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map(m => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

function statusBadgeClass(status: string): string {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700"; // PENDING and anything else in review
}

// Shared channel + message/template block used by both the New and Import modals.
function ChannelFields({
  channel, onChannel, message, onMessage, callPlaceholder,
  templates, waConnected, waTemplate, waParams, onTemplate, onParam,
}: {
  channel: string; onChannel: (c: string) => void;
  message: string; onMessage: (m: string) => void; callPlaceholder: string;
  templates: WaTemplate[]; waConnected: boolean;
  waTemplate: string; waParams: string[]; onTemplate: (name: string) => void; onParam: (i: number, v: string) => void;
}) {
  const selected = templates.find(t => t.name === waTemplate);
  return (
    <>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Channel</label>
        <div className="grid grid-cols-2 gap-2">
          {[["call", "Voice calls"], ["whatsapp", "WhatsApp"]].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onChannel(val)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                channel === val ? "border-primary bg-primary/10 text-foreground" : "border-input text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {channel === "call" ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Offer message *</label>
          <textarea
            value={message}
            onChange={e => onMessage(e.target.value)}
            rows={3}
            placeholder={callPlaceholder}
            className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      ) : !waConnected ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
          WhatsApp isn&apos;t connected for this location. Connect it under Locations first.
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
          No approved templates found. Create and get a template approved in WhatsApp Manager, then it will appear here.
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">WhatsApp template *</label>
            <select value={waTemplate} onChange={e => onTemplate(e.target.value)} className={selectClass}>
              <option value="">Select an approved template…</option>
              {templates.map(t => (
                <option key={`${t.name}_${t.language}`} value={t.name}>
                  {t.name} ({t.language}){t.variables ? ` · ${t.variables} variable${t.variables > 1 ? "s" : ""}` : ""}
                </option>
              ))}
            </select>
          </div>
          {selected?.body && (
            <div className="rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-xs text-muted-foreground whitespace-pre-wrap">
              {selected.body}
            </div>
          )}
          {selected && selected.variables > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Fill each variable. Type <code>{"{name}"}</code> to insert each customer&apos;s name.</p>
              {Array.from({ length: selected.variables }).map((_, i) => (
                <Input
                  key={i}
                  value={waParams[i] || ""}
                  onChange={e => onParam(i, e.target.value)}
                  placeholder={`Variable {{${i + 1}}}${i === 0 ? "  e.g. {name}" : ""}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function CampaignsPage() {
  const { activeLocation } = useActiveLocation();
  const locationId = activeLocation?.id ?? "";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [waConnected, setWaConnected] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [showTemplates, setShowTemplates] = useState(false);
  const [allTemplates, setAllTemplates] = useState<AllTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "MARKETING", language: "en", body: "", example_params: [] as string[] });
  const templateBodyRef = useRef<HTMLTextAreaElement>(null);
  const templateVarCount = countTemplateVars(newTemplate.body);
  const templatePreview = newTemplate.body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const val = newTemplate.example_params[Number(n) - 1];
    return val && val.trim() ? val : `[variable ${n}]`;
  });

  // Insert the next {{n}} token at the textarea cursor. The user never types the
  // curly-brace syntax themselves, just clicks where a detail should change per customer.
  function insertTemplateVariable() {
    const ta = templateBodyRef.current;
    const nextNum = templateVarCount + 1;
    const token = `{{${nextNum}}}`;
    if (!ta) {
      setNewTemplate({ ...newTemplate, body: newTemplate.body + token });
      return;
    }
    const start = ta.selectionStart ?? newTemplate.body.length;
    const end = ta.selectionEnd ?? newTemplate.body.length;
    const nextBody = newTemplate.body.slice(0, start) + token + newTemplate.body.slice(end);
    setNewTemplate({ ...newTemplate, body: nextBody });
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + token.length;
      ta.setSelectionRange(caret, caret);
    });
  }

  const loadAllTemplates = useCallback(async () => {
    if (!locationId) return;
    setTemplatesLoading(true);
    try {
      const r = await apiFetch<{ connected: boolean; templates: AllTemplate[] }>(`/v1/campaigns/templates/all?location_id=${locationId}`);
      setAllTemplates(r.templates || []);
    } catch { setToast({ message: "Failed to load templates", type: "error" }); }
    finally { setTemplatesLoading(false); }
  }, [locationId]);

  function openTemplates() {
    setShowTemplates(true);
    loadAllTemplates();
  }

  async function submitTemplate() {
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) return;
    setCreatingTemplate(true);
    try {
      await apiFetch("/v1/campaigns/templates", {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId,
          name: newTemplate.name,
          category: newTemplate.category,
          language: newTemplate.language,
          body: newTemplate.body,
          example_params: newTemplate.example_params.slice(0, templateVarCount),
        }),
      });
      setToast({ message: "Submitted for review. Meta usually takes a few minutes to a few hours. It'll show up as Approved here (and in the campaign picker) once cleared.", type: "success" });
      setNewTemplate({ name: "", category: "MARKETING", language: "en", body: "", example_params: [] });
      loadAllTemplates();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to submit template", type: "error" });
    } finally { setCreatingTemplate(false); }
  }

  async function openStats(id: string) {
    setStatsLoading(true);
    setStats(null);
    try {
      setStats(await apiFetch<Stats>(`/v1/campaigns/${id}/stats`));
    } catch { setToast({ message: "Failed to load stats", type: "error" }); }
    finally { setStatsLoading(false); }
  }

  async function deleteCampaign(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete campaign "${name}"? This only removes it from history. Already-sent calls/messages aren't affected.`)) return;
    try {
      await apiFetch(`/v1/campaigns/${id}`, { method: "DELETE" });
      setCampaigns(prev => prev.filter(c => c.id !== id));
      setToast({ message: "Campaign deleted", type: "success" });
    } catch { setToast({ message: "Failed to delete campaign", type: "error" }); }
  }

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importForm, setImportForm] = useState({ name: "", message: "", channel: "call", wa_template: "", wa_params: [] as string[] });
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", message: "", audience: "all_customers", channel: "call",
    tier: "", expiring_days: "7", lead_status: "", wa_template: "", wa_params: [] as string[],
  });

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      setCampaigns(await apiFetch<Campaign[]>(`/v1/campaigns?location_id=${locationId}`));
    } catch { setToast({ message: "Failed to load campaigns", type: "error" }); }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadApprovedTemplates = useCallback(() => {
    if (!locationId) return;
    apiFetch<{ connected: boolean; templates: WaTemplate[] }>(`/v1/campaigns/templates?location_id=${locationId}`)
      .then(r => { setWaConnected(r.connected); setTemplates(r.templates || []); })
      .catch(() => { setWaConnected(false); setTemplates([]); });
  }, [locationId]);

  useEffect(() => { loadApprovedTemplates(); }, [loadApprovedTemplates]);

  useEffect(() => { setPreviewCount(null); }, [form.audience, form.tier, form.expiring_days, form.lead_status]);

  // When a template is chosen, size the params array to its variable count.
  function pickTemplate(name: string, current: string[], setter: (t: string, p: string[]) => void) {
    const t = templates.find(x => x.name === name);
    const count = t?.variables ?? 0;
    const next = Array.from({ length: count }).map((_, i) => current[i] ?? "");
    setter(name, next);
  }

  function filterPayload() {
    return {
      location_id: locationId,
      audience: form.audience,
      tier: form.audience === "members_by_tier" ? form.tier || null : null,
      expiring_days: form.audience === "expiring_members" ? Number(form.expiring_days) || 7 : null,
      lead_status: form.audience === "leads" ? form.lead_status || null : null,
    };
  }

  function newFormValid() {
    if (!form.name.trim()) return false;
    return form.channel === "call" ? !!form.message.trim() : !!form.wa_template;
  }
  function importFormValid() {
    if (!importForm.name.trim() || !importFile) return false;
    return importForm.channel === "call" ? !!importForm.message.trim() : !!importForm.wa_template;
  }
  function templateLang(name: string) {
    return templates.find(t => t.name === name)?.language || "en";
  }

  async function preview() {
    setPreviewing(true);
    try {
      const res = await apiFetch<{ count: number }>("/v1/campaigns/preview", {
        method: "POST", body: JSON.stringify(filterPayload()),
      });
      setPreviewCount(res.count);
    } catch { setToast({ message: "Preview failed", type: "error" }); }
    finally { setPreviewing(false); }
  }

  async function launch() {
    if (!newFormValid()) return;
    setSubmitting(true);
    try {
      const payload: any = {
        ...filterPayload(), name: form.name, message: form.message, channel: form.channel,
      };
      if (form.channel === "whatsapp") {
        payload.wa_template = form.wa_template;
        payload.wa_language = templateLang(form.wa_template);
        payload.wa_params = form.wa_params;
      }
      const created = await apiFetch<Campaign>("/v1/campaigns", { method: "POST", body: JSON.stringify(payload) });
      const queued = created.channel === "whatsapp" ? created.messages_queued : created.calls_queued;
      const verb = created.channel === "whatsapp" ? "messages" : "calls";
      setToast({
        message: created.total_targets === 0
          ? "Campaign created, but no contacts matched that audience."
          : `Campaign launched. ${queued} ${verb} queued.`,
        type: created.total_targets === 0 ? "error" : "success",
      });
      setShowNew(false);
      setForm({ name: "", message: "", audience: "all_customers", channel: "call", tier: "", expiring_days: "7", lead_status: "", wa_template: "", wa_params: [] });
      setPreviewCount(null);
      fetchData();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to launch campaign", type: "error" });
    } finally { setSubmitting(false); }
  }

  async function importCampaign() {
    if (!importFormValid() || !locationId) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile as File);
      fd.append("name", importForm.name);
      fd.append("message", importForm.message);
      fd.append("channel", importForm.channel);
      if (importForm.channel === "whatsapp") {
        fd.append("wa_template", importForm.wa_template);
        fd.append("wa_language", templateLang(importForm.wa_template));
        fd.append("wa_params", JSON.stringify(importForm.wa_params));
      }
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/campaigns/import?location_id=${locationId}`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail?.message || "Import failed");
      }
      const created: Campaign = await resp.json();
      const queued = created.channel === "whatsapp" ? created.messages_queued : created.calls_queued;
      const verb = created.channel === "whatsapp" ? "messages" : "calls";
      setToast({
        message: created.total_targets === 0
          ? "No valid contacts found in the file."
          : `Campaign launched. ${queued} ${verb} queued, ${created.skipped} skipped.`,
        type: created.total_targets === 0 ? "error" : "success",
      });
      setShowImport(false);
      setImportForm({ name: "", message: "", channel: "call", wa_template: "", wa_params: [] });
      setImportFile(null);
      if (fileRef.current) fileRef.current.value = "";
      fetchData();
    } catch (e: any) {
      setToast({ message: e.message || "Import failed", type: "error" });
    } finally { setImporting(false); }
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">Campaigns</h1>
          <p className="mt-2 text-muted-foreground">Bulk calls &amp; WhatsApp broadcasts for {activeLocation?.name}</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={openTemplates}>Manage Templates</Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>Import CSV / Excel</Button>
          <Button onClick={() => setShowNew(true)}>+ New Campaign</Button>
        </div>
      </header>

      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-700">
        Pick a channel per campaign: <b>voice calls</b> or a <b>WhatsApp</b> broadcast. WhatsApp uses your approved templates. Suppressed / opted-out contacts are always skipped. <b>Click any campaign</b> to see delivery stats.
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">No campaigns yet. Create one to start promoting.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {["Name", "Channel", "Audience", "Targets", "Queued", "Status", "Created", ""].map(h => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} onClick={() => openStats(c.id)} className="cursor-pointer border-b border-border/60 align-top transition-colors last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground" title={c.wa_template || c.message}>
                      {c.channel === "whatsapp" ? (c.wa_template || "N/A") : c.message}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.channel === "whatsapp" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                      {c.channel === "whatsapp" ? "WhatsApp" : "Call"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{AUDIENCE_LABEL[c.audience] || c.audience}</span>
                    {c.tier && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{c.tier}</span>}
                    {c.expiring_days != null && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">≤{c.expiring_days}d</span>}
                    {c.lead_status && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{c.lead_status}</span>}
                  </td>
                  <td className="px-4 py-3 font-serif text-lg">{c.total_targets}</td>
                  <td className="px-4 py-3 font-serif text-lg">{c.channel === "whatsapp" ? c.messages_queued : c.calls_queued}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      c.status === "running" ? "bg-blue-50 text-blue-700"
                        : c.status === "completed" ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => deleteCampaign(c.id, c.name, e)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <Modal title="New Campaign" onClose={() => setShowNew(false)}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Campaign name *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Diwali 30% off" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Audience</label>
              <select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} className={selectClass}>
                {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            {form.audience === "members_by_tier" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Tier <span className="font-normal text-muted-foreground">(leave blank for all tiers)</span></label>
                <Input value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} placeholder="Gold" />
              </div>
            )}
            {form.audience === "expiring_members" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Expiring within (days)</label>
                <Input type="number" min={1} value={form.expiring_days} onChange={e => setForm({ ...form, expiring_days: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Includes members already lapsed.</p>
              </div>
            )}
            {form.audience === "leads" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Lead status <span className="font-normal text-muted-foreground">(blank = all)</span></label>
                <select value={form.lead_status} onChange={e => setForm({ ...form, lead_status: e.target.value })} className={selectClass}>
                  <option value="">All statuses</option>
                  {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
            )}

            <ChannelFields
              channel={form.channel}
              onChannel={c => setForm({ ...form, channel: c })}
              message={form.message}
              onMessage={m => setForm({ ...form, message: m })}
              callPlaceholder="The offer the AI will pitch on the call, e.g. '30% off annual memberships this month.'"
              templates={templates}
              waConnected={waConnected}
              waTemplate={form.wa_template}
              waParams={form.wa_params}
              onTemplate={name => pickTemplate(name, form.wa_params, (t, p) => setForm({ ...form, wa_template: t, wa_params: p }))}
              onParam={(i, v) => setForm({ ...form, wa_params: form.wa_params.map((p, idx) => (idx === i ? v : p)) })}
            />

            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
              <Button type="button" variant="outline" size="sm" onClick={preview} disabled={previewing}>
                {previewing ? "Checking…" : "Preview reach"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {previewCount === null ? "See how many people this will reach." : (
                  <><b className="text-foreground">{previewCount}</b> contact{previewCount === 1 ? "" : "s"} will be reached.</>
                )}
              </span>
            </div>

            <Button onClick={launch} disabled={submitting || !newFormValid()} className="w-full">
              {submitting ? "Launching…" : form.channel === "whatsapp" ? "Launch WhatsApp Broadcast" : "Launch Campaign & Start Calling"}
            </Button>
          </div>
        </Modal>
      )}

      {showImport && (
        <Modal title="Import List & Send" onClose={() => setShowImport(false)}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Campaign name *</label>
              <Input value={importForm.name} onChange={e => setImportForm({ ...importForm, name: e.target.value })} placeholder="August promo list" />
            </div>

            <ChannelFields
              channel={importForm.channel}
              onChannel={c => setImportForm({ ...importForm, channel: c })}
              message={importForm.message}
              onMessage={m => setImportForm({ ...importForm, message: m })}
              callPlaceholder="The offer the AI will pitch on each call."
              templates={templates}
              waConnected={waConnected}
              waTemplate={importForm.wa_template}
              waParams={importForm.wa_params}
              onTemplate={name => pickTemplate(name, importForm.wa_params, (t, p) => setImportForm({ ...importForm, wa_template: t, wa_params: p }))}
              onParam={(i, v) => setImportForm({ ...importForm, wa_params: importForm.wa_params.map((p, idx) => (idx === i ? v : p)) })}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Contact file (.csv or .xlsx) *</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Columns: <code>phone</code> (required; a 10-digit number is fine, +91 is added automatically), <code>full_name</code> (optional). Suppressed / opted-out numbers are skipped.
              </p>
            </div>

            <Button onClick={importCampaign} disabled={importing || !importFormValid()} className="w-full">
              {importing ? "Uploading & launching…" : importForm.channel === "whatsapp" ? "Upload & Send WhatsApp" : "Upload & Start Calling"}
            </Button>
          </div>
        </Modal>
      )}

      {showTemplates && (
        <Modal title="WhatsApp Templates" width={780} onClose={() => { setShowTemplates(false); loadApprovedTemplates(); }}>
          <p className="text-sm text-muted-foreground">
            Submit a template for Meta&apos;s review here. Once approved, it appears automatically in the campaign
            picker, so there&apos;s no need to create it in WhatsApp Manager separately.
          </p>

          {/* The whole modal scrolls as one unit (matches every other modal in the app);
              min-w-0 on both columns keeps a long name/body from forcing horizontal overflow
              in the CSS grid, which is what produced the extra scrollbar. */}
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[240px_1fr]">
            <div className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Your templates</h3>
              {templatesLoading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
              ) : !waConnected ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
                  WhatsApp isn&apos;t connected for this location. Connect it under Locations first.
                </div>
              ) : allTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet. Submit your first one.</p>
              ) : (
                <div className="space-y-2">
                  {allTemplates.map(t => (
                    <div key={`${t.name}_${t.language}`} className="min-w-0 rounded-xl border border-border px-3 py-2.5">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{t.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(t.status)}`}>
                          {t.status === "PENDING" ? "In review" : t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.category} · {t.language}</p>
                      {t.body && <p className="mt-1.5 break-words text-xs text-muted-foreground">{t.body}</p>}
                      {t.status === "REJECTED" && t.rejected_reason && (
                        <p className="mt-1.5 break-words text-xs text-rose-600">Rejected: {t.rejected_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {waConnected && (
              <div className="min-w-0 space-y-3.5 border-t border-border pt-5 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                <h3 className="text-sm font-semibold text-foreground">New template</h3>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Name *</label>
                  <Input
                    value={newTemplate.name}
                    onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="diwali_offer_2026"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Lowercase, numbers, and underscores only. Auto-corrected on submit.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Category</label>
                    <select value={newTemplate.category} onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value })} className={selectClass}>
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Language</label>
                    <select value={newTemplate.language} onChange={e => setNewTemplate({ ...newTemplate, language: e.target.value })} className={selectClass}>
                      {TEMPLATE_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-foreground">Message *</label>
                    <button
                      type="button"
                      onClick={insertTemplateVariable}
                      className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/70"
                    >
                      + Insert variable
                    </button>
                  </div>
                  <textarea
                    ref={templateBodyRef}
                    value={newTemplate.body}
                    onChange={e => setNewTemplate({ ...newTemplate, body: e.target.value })}
                    rows={4}
                    placeholder="Hi there, we're running a special offer this month..."
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Write it like a normal message. Put your cursor where a detail changes per customer (a name, a date) and click &quot;Insert variable&quot;.
                  </p>
                </div>

                {templateVarCount > 0 && (
                  <div className="min-w-0 space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-xs font-medium text-foreground">Fill in an example for each variable</p>
                    <p className="text-xs text-muted-foreground">Shown to Meta during review only. Never sent to customers.</p>
                    {Array.from({ length: templateVarCount }).map((_, i) => (
                      <div key={i} className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-foreground">
                          {i + 1}
                        </span>
                        <Input
                          value={newTemplate.example_params[i] || ""}
                          onChange={e => {
                            const next = [...newTemplate.example_params];
                            next[i] = e.target.value;
                            setNewTemplate({ ...newTemplate, example_params: next });
                          }}
                          placeholder={i === 0 ? "e.g. Ravi" : "e.g. Monday 10am"}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {newTemplate.body.trim() && (
                  <div className="min-w-0">
                    <p className="mb-1.5 text-xs font-medium text-foreground">Preview</p>
                    <div className="break-words rounded-xl bg-emerald-100 px-3.5 py-2.5 text-sm text-emerald-950">
                      {templatePreview}
                    </div>
                  </div>
                )}

                <Button
                  onClick={submitTemplate}
                  disabled={creatingTemplate || !newTemplate.name.trim() || !newTemplate.body.trim()}
                  className="w-full"
                >
                  {creatingTemplate ? "Submitting…" : "Submit for Review"}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {(stats || statsLoading) && (
        <Modal title={stats ? `Delivery for ${stats.name}` : "Delivery"} onClose={() => setStats(null)}>
          {statsLoading || !stats ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : stats.channel === "whatsapp" && stats.whatsapp ? (
            <div className="flex flex-col gap-3">
              {(() => {
                const w = stats.whatsapp!;
                const base = Math.max(stats.queued, w.sent, 1);
                const rows = [
                  { label: "Queued", value: stats.queued, color: "bg-slate-400" },
                  { label: "Sent", value: w.sent, color: "bg-blue-400" },
                  { label: "Delivered", value: w.delivered, color: "bg-violet-400" },
                  { label: "Read", value: w.read, color: "bg-emerald-500" },
                ];
                return rows.map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-muted-foreground">{r.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.round((r.value / base) * 100)}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-semibold text-foreground">{r.value}</span>
                  </div>
                ));
              })()}
              <div className="mt-1 flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-semibold text-rose-600">{stats.whatsapp.failed}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.whatsapp.sent === 0
                  ? "No delivery data yet. Statuses arrive from Meta within a minute or two of sending."
                  : "Delivered/Read update as Meta reports back. A number stuck at Sent may be in Meta's experiment (130472)."}
              </p>
            </div>
          ) : stats.channel === "call" && stats.calls ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">Calls with a result</span>
                <span className="font-semibold text-foreground">{stats.calls.total} / {stats.queued}</span>
              </div>
              {Object.keys(stats.calls.outcomes).length === 0 ? (
                <p className="text-sm text-muted-foreground">No call results yet. Outcomes appear once Bolna reports each call back (needs the Bolna webhook configured).</p>
              ) : (
                Object.entries(stats.calls.outcomes).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-foreground">{v}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No stats available.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
