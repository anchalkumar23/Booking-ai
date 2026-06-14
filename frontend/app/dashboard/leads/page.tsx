"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Location { id: string; name: string; }
interface Lead {
  id: string; full_name: string; phone: string; language: string;
  source: string; status: string; wa_sequence_step: number;
  wa_stopped: boolean; call_stopped: boolean; created_at: string;
  location_id: string;
}

const STATUSES = ["new","contacted","interested","converted","not_interested"];
const PIPELINE_COLORS: Record<string,string> = {
  new:"bg-slate-400", contacted:"bg-blue-400", interested:"bg-violet-400",
  converted:"bg-emerald-500", not_interested:"bg-rose-400",
};
const PIPELINE_BORDER_COLORS: Record<string,string> = {
  new:"border-slate-400", contacted:"border-blue-400", interested:"border-violet-400",
  converted:"border-emerald-500", not_interested:"border-rose-400",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ location_id:"", full_name:"", phone:"", language:"en", source:"manual" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterLocation) params.set("location_id", filterLocation);
      if (search) params.set("search", search);
      const [ls, locs] = await Promise.all([
        apiFetch<Lead[]>(`/v1/leads?${params}`),
        apiFetch<Location[]>("/v1/locations"),
      ]);
      setLeads(ls);
      setLocations(locs);
    } catch { setToast({message:"Failed to load leads",type:"error"}); }
    finally { setLoading(false); }
  }, [filterStatus, filterLocation, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addLead() {
    if (!form.location_id || !form.full_name || !form.phone) return;
    setSubmitting(true);
    try {
      await apiFetch("/v1/leads", { method:"POST", body:JSON.stringify(form) });
      setToast({message:"Lead added — outreach started",type:"success"});
      setShowAdd(false);
      setForm({location_id:"",full_name:"",phone:"",language:"en",source:"manual"});
      fetchData();
    } catch (e: any) {
      setToast({message:e.detail?.message || "Failed to add lead",type:"error"});
    } finally { setSubmitting(false); }
  }

  async function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !filterLocation) {
      setToast({message:"Select a location filter first, then import CSV",type:"error"});
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/leads/import?location_id=${filterLocation}`, {
        method:"POST", body: formData, credentials:"include",
      });
      const result = await resp.json();
      setToast({message:`Imported ${result.created} leads, skipped ${result.skipped}`,type:"success"});
      fetchData();
    } catch { setToast({message:"CSV import failed",type:"error"}); }
    finally { setImporting(false); e.target.value = ""; }
  }

  async function patchLead(id: string, data: object) {
    try {
      await apiFetch(`/v1/leads/${id}`, { method:"PUT", body:JSON.stringify(data) });
      fetchData();
    } catch { setToast({message:"Update failed",type:"error"}); }
  }

  async function stopOutreach(id: string) {
    if (!confirm("Stop all outreach for this lead?")) return;
    try {
      await apiFetch(`/v1/leads/${id}/stop`, { method:"PATCH" });
      setToast({message:"Outreach stopped",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed",type:"error"}); }
  }

  async function deleteLead(id: string, name: string) {
    if (!confirm(`Delete lead "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/v1/leads/${id}`, { method:"DELETE" });
      setToast({message:"Lead deleted",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed to delete",type:"error"}); }
  }

  async function convertLead(id: string) {
    try {
      await apiFetch(`/v1/leads/${id}/convert`, { method:"PATCH" });
      setToast({message:"Lead converted ✓",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed",type:"error"}); }
  }

  const locationName = (id: string) => locations.find(l => l.id === id)?.name || "—";

  // Pipeline summary
  const summary = STATUSES.reduce((acc, s) => ({ ...acc, [s]: leads.filter(l => l.status === s).length }), {} as Record<string,number>);

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">🎯 Leads</h1>
          <p className="mt-2 text-muted-foreground">Manage lead outreach across calls and WhatsApp</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importing…" : "⬆ Import CSV"}
          </Button>
          <Button onClick={() => setShowAdd(true)}>+ Add Lead</Button>
        </div>
      </header>

      {/* Pipeline summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-sm transition-colors ${filterStatus===s ? PIPELINE_BORDER_COLORS[s] : "border-border"}`}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${PIPELINE_COLORS[s]}`} />
              <span className="text-xs font-semibold capitalize text-muted-foreground">{s.replace("_"," ")}</span>
            </div>
            <div className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl">{summary[s] || 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-64" />
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-56">
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <Button variant="secondary" onClick={fetchData}>Refresh</Button>
      </div>

      {/* CSV tip */}
      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs text-violet-700">
        💡 <b>CSV Import:</b> Select a location first, then click &quot;Import CSV&quot;. Format: <code>full_name,phone,language,source</code>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">No leads found. Add one or import a CSV.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {["Name","Phone","Language","Source","Status","WA Step","Outreach","Actions"].map(h => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{l.full_name}</span><br/>
                    <span className="text-xs text-muted-foreground">{locationName(l.location_id)}</span>
                  </td>
                  <td className="px-4 py-3">{l.phone}</td>
                  <td className="px-4 py-3">{l.language.toUpperCase()}</td>
                  <td className="px-4 py-3">{l.source}</td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">Step {l.wa_sequence_step}/4</span>
                    <div className="mt-1 flex gap-1">
                      {l.wa_stopped && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">WA stopped</span>}
                      {l.call_stopped && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">Calls stopped</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {!l.wa_stopped && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">💬 Active</span>}
                      {!l.call_stopped && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">📞 Active</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {l.status !== "converted" && (
                        <Button size="sm" variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => convertLead(l.id)}>Convert</Button>
                      )}
                      {!l.wa_stopped && !l.call_stopped && (
                        <Button size="sm" variant="destructive" onClick={() => stopOutreach(l.id)}>Stop</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => deleteLead(l.id, l.full_name)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <Modal title="Add New Lead" onClose={() => setShowAdd(false)}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Location *</label>
              <select value={form.location_id} onChange={e => setForm({...form,location_id:e.target.value})} className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40">
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name *</label>
                <Input value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} placeholder="Ravi Kumar" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Phone *</label>
                <Input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+919876543210" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Language</label>
                <select value={form.language} onChange={e => setForm({...form,language:e.target.value})} className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Source</label>
                <Input value={form.source} onChange={e => setForm({...form,source:e.target.value})} placeholder="facebook_ad" />
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
              ✅ Adding this lead will <b>automatically start</b> the 4-step WhatsApp sequence and a Bolna cold call.
            </div>
            <Button onClick={addLead} disabled={submitting || !form.location_id || !form.full_name || !form.phone} className="w-full">
              {submitting ? "Adding…" : "Add Lead & Start Outreach"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
