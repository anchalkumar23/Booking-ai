"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/lib/location-context";

interface Campaign {
  id: string; name: string; message: string; audience: string;
  tier: string | null; expiring_days: number | null; lead_status: string | null;
  status: string; total_targets: number; calls_queued: number; skipped: number;
  created_at: string;
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

  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importForm, setImportForm] = useState({ name: "", message: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", message: "", audience: "all_customers",
    tier: "", expiring_days: "7", lead_status: "",
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

  // Reset preview whenever the audience filters change
  useEffect(() => { setPreviewCount(null); }, [form.audience, form.tier, form.expiring_days, form.lead_status]);

  function filterPayload() {
    return {
      location_id: locationId,
      audience: form.audience,
      tier: form.audience === "members_by_tier" ? form.tier || null : null,
      expiring_days: form.audience === "expiring_members" ? Number(form.expiring_days) || 7 : null,
      lead_status: form.audience === "leads" ? form.lead_status || null : null,
    };
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
    if (!form.name.trim() || !form.message.trim()) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<Campaign>("/v1/campaigns", {
        method: "POST", body: JSON.stringify({ ...filterPayload(), name: form.name, message: form.message }),
      });
      setToast({
        message: created.total_targets === 0
          ? "Campaign created, but no contacts matched that audience."
          : `Campaign launched — ${created.calls_queued} calls queued (1 min apart).`,
        type: created.total_targets === 0 ? "error" : "success",
      });
      setShowNew(false);
      setForm({ name: "", message: "", audience: "all_customers", tier: "", expiring_days: "7", lead_status: "" });
      setPreviewCount(null);
      fetchData();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to launch campaign", type: "error" });
    } finally { setSubmitting(false); }
  }

  async function importCampaign() {
    if (!importForm.name.trim() || !importForm.message.trim() || !importFile || !locationId) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("name", importForm.name);
      fd.append("message", importForm.message);
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/campaigns/import?location_id=${locationId}`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail?.message || "Import failed");
      }
      const created: Campaign = await resp.json();
      setToast({
        message: created.total_targets === 0
          ? "No valid contacts found in the file."
          : `Campaign launched — ${created.calls_queued} calls queued (1 min apart), ${created.skipped} skipped.`,
        type: created.total_targets === 0 ? "error" : "success",
      });
      setShowImport(false);
      setImportForm({ name: "", message: "" });
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
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">📣 Promo Campaigns</h1>
          <p className="mt-2 text-muted-foreground">Bulk promotional calls for {activeLocation?.name}</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={() => setShowImport(true)}>⬆ Import CSV / Excel</Button>
          <Button onClick={() => setShowNew(true)}>+ New Campaign</Button>
        </div>
      </header>

      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-700">
        💡 Each campaign calls everyone in the chosen audience with your offer, <b>1 minute apart</b>. Suppressed / DND / opted-out contacts are skipped automatically.
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
                {["Name", "Audience", "Targets", "Calls Queued", "Status", "Created"].map(h => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{c.name}</span>
                    <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground" title={c.message}>{c.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{AUDIENCE_LABEL[c.audience] || c.audience}</span>
                    {c.tier && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{c.tier}</span>}
                    {c.expiring_days != null && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">≤{c.expiring_days}d</span>}
                    {c.lead_status && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{c.lead_status}</span>}
                  </td>
                  <td className="px-4 py-3 font-serif text-lg">{c.total_targets}</td>
                  <td className="px-4 py-3 font-serif text-lg">{c.calls_queued}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <Modal title="New Promo Campaign" onClose={() => setShowNew(false)}>
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
                <p className="mt-1 text-xs text-muted-foreground">Includes members already lapsed. e.g. 7 = expiring in the next week or already expired.</p>
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

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Offer message *</label>
              <textarea
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={4}
                placeholder="Tell customers about the offer. The AI will pitch this on the call, e.g. 'We're running 30% off annual memberships until the end of the month — would you like to renew at this rate?'"
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5">
              <Button type="button" variant="outline" size="sm" onClick={preview} disabled={previewing}>
                {previewing ? "Checking…" : "Preview reach"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {previewCount === null ? "See how many people this will call." : (
                  <><b className="text-foreground">{previewCount}</b> contact{previewCount === 1 ? "" : "s"} will be called (~{previewCount} min to dial all).</>
                )}
              </span>
            </div>

            <Button onClick={launch} disabled={submitting || !form.name.trim() || !form.message.trim()} className="w-full">
              {submitting ? "Launching…" : "Launch Campaign & Start Calling"}
            </Button>
          </div>
        </Modal>
      )}

      {showImport && (
        <Modal title="Import Contact List & Call" onClose={() => setShowImport(false)}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Campaign name *</label>
              <Input value={importForm.name} onChange={e => setImportForm({ ...importForm, name: e.target.value })} placeholder="August promo list" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Offer message *</label>
              <textarea
                value={importForm.message}
                onChange={e => setImportForm({ ...importForm, message: e.target.value })}
                rows={3}
                placeholder="The offer the AI will pitch on each call."
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

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
                Columns: <code>phone</code> (required, with +91), <code>full_name</code> (optional). Calls go out 1 min apart; suppressed/opted-out numbers are skipped.
              </p>
            </div>

            <Button onClick={importCampaign} disabled={importing || !importForm.name.trim() || !importForm.message.trim() || !importFile} className="w-full">
              {importing ? "Uploading & launching…" : "Upload & Start Calling"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
