"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";

interface Location { id: string; name: string; }
interface Lead {
  id: string; full_name: string; phone: string; language: string;
  source: string; status: string; wa_sequence_step: number;
  wa_stopped: boolean; call_stopped: boolean; created_at: string;
  location_id: string;
}

const STATUSES = ["new","contacted","interested","converted","not_interested"];
const PIPELINE_COLORS: Record<string,string> = {
  new:"#94a3b8", contacted:"#60a5fa", interested:"#a78bfa",
  converted:"#10b981", not_interested:"#f87171",
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
    <div style={{ padding:32, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <input ref={fileRef} type="file" accept=".csv" onChange={importCSV} style={{display:"none"}} />

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#0f172a", marginBottom:4 }}>🎯 Leads</h1>
          <p style={{ fontSize:14, color:"#94a3b8" }}>Manage lead outreach across calls and WhatsApp</p>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => fileRef.current?.click()} disabled={importing} style={outlineBtnStyle}>
            {importing ? "Importing…" : "⬆ Import CSV"}
          </button>
          <button onClick={() => setShowAdd(true)} style={gradientBtnStyle}>+ Add Lead</button>
        </div>
      </div>

      {/* Pipeline summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:24 }}>
        {STATUSES.map(s => (
          <div key={s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            style={{ background:"white", borderRadius:12, padding:"14px 16px", border:`2px solid ${filterStatus===s ? PIPELINE_COLORS[s] : "#edf1f7"}`, cursor:"pointer", transition:"all 0.15s" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:PIPELINE_COLORS[s] }} />
              <span style={{ fontSize:11, fontWeight:600, color:"#94a3b8", textTransform:"capitalize" }}>{s.replace("_"," ")}</span>
            </div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#0f172a" }}>{summary[s] || 0}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <input placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} style={selectStyle} />
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={selectStyle}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={fetchData} style={{ ...selectStyle, background:"#f1f5f9", cursor:"pointer", border:"none", fontWeight:600 }}>Refresh</button>
      </div>

      {/* CSV tip */}
      <div style={{ background:"#faf5ff", border:"1px solid #e9d5ff", borderRadius:10, padding:"10px 16px", marginBottom:20, fontSize:12, color:"#6d28d9" }}>
        💡 <b>CSV Import:</b> Select a location first, then click "Import CSV". Format: <code>full_name,phone,language,source</code>
      </div>

      {/* Table */}
      <div style={{ background:"white", borderRadius:16, border:"1px solid #edf1f7", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>Loading…</div>
        ) : leads.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>No leads found. Add one or import a CSV.</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc", borderBottom:"1px solid #edf1f7" }}>
                {["Name","Phone","Language","Source","Status","WA Step","Outreach","Actions"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={l.id} style={{ borderBottom:"1px solid #f1f5f9", background: i%2===0?"white":"#fafbff" }}>
                  <td style={tdStyle}><b style={{color:"#0f172a"}}>{l.full_name}</b><br/><span style={{fontSize:11,color:"#94a3b8"}}>{locationName(l.location_id)}</span></td>
                  <td style={tdStyle}>{l.phone}</td>
                  <td style={tdStyle}>{l.language.toUpperCase()}</td>
                  <td style={tdStyle}>{l.source}</td>
                  <td style={tdStyle}><StatusBadge status={l.status} /></td>
                  <td style={tdStyle}>
                    <span style={{ fontSize:11, color:"#64748b" }}>Step {l.wa_sequence_step}/4</span>
                    <div style={{ display:"flex", gap:4, marginTop:3 }}>
                      {l.wa_stopped && <span style={{ fontSize:10, background:"#fef2f2", color:"#b91c1c", padding:"1px 6px", borderRadius:20 }}>WA stopped</span>}
                      {l.call_stopped && <span style={{ fontSize:10, background:"#fef2f2", color:"#b91c1c", padding:"1px 6px", borderRadius:20 }}>Calls stopped</span>}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display:"flex", gap:4 }}>
                      {!l.wa_stopped && <span style={{ fontSize:10, background:"#f0fdf4", color:"#15803d", padding:"2px 7px", borderRadius:20 }}>💬 Active</span>}
                      {!l.call_stopped && <span style={{ fontSize:10, background:"#eff6ff", color:"#1d4ed8", padding:"2px 7px", borderRadius:20 }}>📞 Active</span>}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {l.status !== "converted" && (
                        <button onClick={() => convertLead(l.id)} style={successBtnStyle}>Convert</button>
                      )}
                      {!l.wa_stopped && !l.call_stopped && (
                        <button onClick={() => stopOutreach(l.id)} style={dangerBtnStyle}>Stop</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAdd && (
        <Modal title="Add New Lead" onClose={() => setShowAdd(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={labelStyle}>Location *</label>
              <select value={form.location_id} onChange={e => setForm({...form,location_id:e.target.value})} style={inputStyle}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} placeholder="Ravi Kumar" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+919876543210" style={inputStyle} />
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={labelStyle}>Language</label>
                <select value={form.language} onChange={e => setForm({...form,language:e.target.value})} style={inputStyle}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Source</label>
                <input value={form.source} onChange={e => setForm({...form,source:e.target.value})} placeholder="facebook_ad" style={inputStyle} />
              </div>
            </div>
            <div style={{ background:"#f0fdf4", border:"1px solid #bbf7e6", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#15803d" }}>
              ✅ Adding this lead will <b>automatically start</b> the 4-step WhatsApp sequence and a Bolna cold call.
            </div>
            <button onClick={addLead} disabled={submitting || !form.location_id || !form.full_name || !form.phone} style={{ ...gradientBtnStyle, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Adding…" : "Add Lead & Start Outreach"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding:"9px 14px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none" };
const thStyle: React.CSSProperties = { padding:"12px 16px", textAlign:"left", fontWeight:600, color:"#64748b", fontSize:11, letterSpacing:"0.04em", textTransform:"uppercase" as const };
const tdStyle: React.CSSProperties = { padding:"12px 16px", color:"#475569" };
const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6, letterSpacing:"0.02em" };
const inputStyle: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none", boxSizing:"border-box" as const };
const gradientBtnStyle: React.CSSProperties = { padding:"11px 20px", borderRadius:10, border:"none", background:"linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)", color:"white", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(167,139,250,0.35)" };
const outlineBtnStyle: React.CSSProperties = { padding:"10px 18px", borderRadius:10, border:"1.5px solid #e8edf5", background:"white", color:"#475569", fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:600, fontSize:13, cursor:"pointer" };
const dangerBtnStyle: React.CSSProperties = { padding:"4px 10px", borderRadius:7, border:"1.5px solid #fca5a5", background:"#fef2f2", color:"#b91c1c", fontSize:11, fontWeight:600, cursor:"pointer" };
const successBtnStyle: React.CSSProperties = { padding:"4px 10px", borderRadius:7, border:"1.5px solid #86efac", background:"#f0fdf4", color:"#15803d", fontSize:11, fontWeight:600, cursor:"pointer" };
