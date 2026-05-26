"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";

interface Location {
  id: string; name: string; type: string; city: string;
  phone: string; timezone: string; is_active: boolean; created_at: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name:"", type:"gym", city:"", phone:"", timezone:"Asia/Kolkata" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { setLocations(await apiFetch<Location[]>("/v1/locations")); }
    catch { setToast({message:"Failed to load",type:"error"}); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addLocation() {
    setSubmitting(true);
    try {
      await apiFetch("/v1/locations", { method:"POST", body:JSON.stringify(form) });
      setToast({message:"Location added",type:"success"});
      setShowAdd(false);
      setForm({name:"",type:"gym",city:"",phone:"",timezone:"Asia/Kolkata"});
      fetchData();
    } catch (e: any) {
      setToast({message:e.detail?.message || "Failed",type:"error"});
    } finally { setSubmitting(false); }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this location?")) return;
    try {
      await apiFetch(`/v1/locations/${id}/deactivate`, { method:"PATCH" });
      setToast({message:"Location deactivated",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed",type:"error"}); }
  }

  const TYPE_ICONS: Record<string,string> = { gym:"🏋️", salon:"💇", restaurant:"🍽️" };

  return (
    <div style={{ padding:32, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#0f172a", marginBottom:4 }}>🏢 Locations</h1>
          <p style={{ fontSize:14, color:"#94a3b8" }}>{locations.length} business locations</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={gradientBtnStyle}>+ Add Location</button>
      </div>
      {loading ? <div style={{ color:"#94a3b8" }}>Loading…</div> :
      locations.length === 0 ? (
        <div style={{ textAlign:"center", padding:64, color:"#94a3b8" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🏢</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:"#0f172a", marginBottom:8 }}>No locations yet</div>
          <div style={{ marginBottom:20 }}>Add your first gym, salon or restaurant</div>
          <button onClick={() => setShowAdd(true)} style={gradientBtnStyle}>+ Add Location</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
          {locations.map(l => (
            <div key={l.id} style={{ background:"white", borderRadius:16, padding:22, border:"1px solid #edf1f7", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ fontSize:28 }}>{TYPE_ICONS[l.type] || "🏢"}</div>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color:"#0f172a" }}>{l.name}</div>
                    <div style={{ fontSize:12, color:"#94a3b8" }}>{l.city}</div>
                  </div>
                </div>
                <StatusBadge status={l.type} />
              </div>
              <div style={{ fontSize:13, color:"#64748b", display:"flex", flexDirection:"column", gap:4, marginBottom:14 }}>
                <div>📞 {l.phone}</div>
                <div>🕐 {l.timezone}</div>
                <div>📋 ID: <code style={{fontSize:11,background:"#f1f5f9",padding:"1px 6px",borderRadius:4}}>{l.id.slice(0,8)}…</code></div>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, background:l.is_active?"#f0fdf4":"#f1f5f9", color:l.is_active?"#15803d":"#94a3b8", padding:"3px 10px", borderRadius:20, fontWeight:600 }}>
                  {l.is_active ? "Active" : "Inactive"}
                </span>
                {l.is_active && <button onClick={() => deactivate(l.id)} style={{ fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid #fca5a5", background:"#fef2f2", color:"#b91c1c", cursor:"pointer" }}>Deactivate</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <Modal title="Add Location" onClose={() => setShowAdd(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={labelStyle}>Business Name *</label><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Chennai Fitness Hub" style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Type *</label>
                <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} style={inputStyle}>
                  <option value="gym">🏋️ Gym</option>
                  <option value="salon">💇 Salon</option>
                  <option value="restaurant">🍽️ Restaurant</option>
                </select>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={labelStyle}>City *</label><input value={form.city} onChange={e => setForm({...form,city:e.target.value})} placeholder="Chennai" style={inputStyle} /></div>
              <div><label style={labelStyle}>Phone *</label><input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+919876543210" style={inputStyle} /></div>
            </div>
            <div>
              <label style={labelStyle}>Timezone</label>
              <select value={form.timezone} onChange={e => setForm({...form,timezone:e.target.value})} style={inputStyle}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Chennai">Asia/Chennai</option>
              </select>
            </div>
            <button onClick={addLocation} disabled={submitting || !form.name || !form.city || !form.phone} style={{ ...gradientBtnStyle, opacity:submitting?0.7:1 }}>
              {submitting ? "Adding…" : "Add Location"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };
const inputStyle: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none", boxSizing:"border-box" as const };
const gradientBtnStyle: React.CSSProperties = { padding:"11px 20px", borderRadius:10, border:"none", background:"linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)", color:"white", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(167,139,250,0.35)" };
