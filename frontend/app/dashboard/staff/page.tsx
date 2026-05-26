"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";

interface Location { id: string; name: string; }
interface StaffMember {
  id: string; full_name: string; phone: string | null;
  working_hours: Record<string, {start:string;end:string}|null>;
  is_active: boolean; location_id: string; created_at: string;
}

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS: Record<string,string> = { mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat",sun:"Sun" };

const DEFAULT_HOURS = {
  mon:{start:"09:00",end:"18:00"}, tue:{start:"09:00",end:"18:00"},
  wed:{start:"09:00",end:"18:00"}, thu:{start:"09:00",end:"18:00"},
  fri:{start:"09:00",end:"18:00"}, sat:{start:"10:00",end:"15:00"}, sun:null,
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterLocation, setFilterLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ location_id:"", full_name:"", phone:"", working_hours: DEFAULT_HOURS as any });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLocation) params.set("location_id", filterLocation);
      const [s, l] = await Promise.all([
        apiFetch<StaffMember[]>(`/v1/staff?${params}`),
        apiFetch<Location[]>("/v1/locations"),
      ]);
      setStaff(s); setLocations(l);
    } catch { setToast({message:"Failed to load",type:"error"}); }
    finally { setLoading(false); }
  }, [filterLocation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleDay(day: string) {
    const h = form.working_hours;
    setForm({...form, working_hours: { ...h, [day]: h[day] ? null : {start:"09:00",end:"18:00"} }});
  }

  async function addStaff() {
    setSubmitting(true);
    try {
      await apiFetch("/v1/staff", { method:"POST", body:JSON.stringify({
        location_id: form.location_id,
        full_name: form.full_name,
        phone: form.phone || undefined,
        working_hours: form.working_hours,
      })});
      setToast({message:"Staff member added",type:"success"});
      setShowAdd(false);
      setForm({location_id:"",full_name:"",phone:"",working_hours:DEFAULT_HOURS});
      fetchData();
    } catch (e: any) {
      setToast({message:e.detail?.message || "Failed",type:"error"});
    } finally { setSubmitting(false); }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this staff member?")) return;
    try {
      await apiFetch(`/v1/staff/${id}/deactivate`, { method:"PATCH" });
      setToast({message:"Staff deactivated",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed",type:"error"}); }
  }

  const locationName = (id: string) => locations.find(l => l.id === id)?.name || "—";

  function hoursDisplay(wh: Record<string,any>) {
    return DAYS.filter(d => wh[d]).map(d => `${DAY_LABELS[d]} ${wh[d].start}-${wh[d].end}`).join(" · ") || "No hours set";
  }

  return (
    <div style={{ padding:32, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#0f172a", marginBottom:4 }}>👤 Staff</h1>
          <p style={{ fontSize:14, color:"#94a3b8" }}>Manage staff members and their working hours</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={gradientBtnStyle}>+ Add Staff</button>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={selectStyle}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:16 }}>
        {loading ? <div style={{ color:"#94a3b8" }}>Loading…</div> :
        staff.length === 0 ? <div style={{ color:"#94a3b8" }}>No staff found.</div> :
        staff.map(s => (
          <div key={s.id} style={{ background:"white", borderRadius:16, padding:20, border:"1px solid #edf1f7", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:"#0f172a" }}>{s.full_name}</div>
                <div style={{ fontSize:12, color:"#94a3b8" }}>{locationName(s.location_id)} · {s.phone || "No phone"}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, background:s.is_active?"#f0fdf4":"#f1f5f9", color:s.is_active?"#15803d":"#94a3b8", padding:"2px 8px", borderRadius:20, fontWeight:600 }}>
                  {s.is_active ? "Active" : "Inactive"}
                </span>
                {s.is_active && <button onClick={() => deactivate(s.id)} style={{ fontSize:11, padding:"3px 8px", borderRadius:7, border:"1px solid #fca5a5", background:"#fef2f2", color:"#b91c1c", cursor:"pointer" }}>Deactivate</button>}
              </div>
            </div>
            <div style={{ fontSize:11, color:"#64748b", background:"#f8fafc", borderRadius:8, padding:"8px 10px", lineHeight:1.8 }}>
              {hoursDisplay(s.working_hours)}
            </div>
          </div>
        ))}
      </div>
      {showAdd && (
        <Modal title="Add Staff Member" onClose={() => setShowAdd(false)} width={560}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={labelStyle}>Location *</label>
              <select value={form.location_id} onChange={e => setForm({...form,location_id:e.target.value})} style={inputStyle}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={labelStyle}>Full Name *</label><input value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} style={inputStyle} /></div>
              <div><label style={labelStyle}>Phone</label><input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} style={inputStyle} /></div>
            </div>
            <div>
              <label style={labelStyle}>Working Hours — click day to toggle on/off</label>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {DAYS.map(day => (
                  <div key={day} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <button onClick={() => toggleDay(day)} style={{ width:48, padding:"5px 0", borderRadius:7, border:`1.5px solid ${form.working_hours[day]?"#a78bfa":"#e2e8f0"}`, background:form.working_hours[day]?"#f5f3ff":"#f8fafc", color:form.working_hours[day]?"#6d28d9":"#94a3b8", fontWeight:600, fontSize:11, cursor:"pointer" }}>
                      {DAY_LABELS[day]}
                    </button>
                    {form.working_hours[day] ? (
                      <>
                        <input type="time" value={form.working_hours[day].start} onChange={e => setForm({...form,working_hours:{...form.working_hours,[day]:{...form.working_hours[day],start:e.target.value}}})} style={{...inputStyle,width:120,padding:"6px 10px"}} />
                        <span style={{color:"#94a3b8",fontSize:13}}>to</span>
                        <input type="time" value={form.working_hours[day].end} onChange={e => setForm({...form,working_hours:{...form.working_hours,[day]:{...form.working_hours[day],end:e.target.value}}})} style={{...inputStyle,width:120,padding:"6px 10px"}} />
                      </>
                    ) : <span style={{fontSize:12,color:"#94a3b8"}}>Day off</span>}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={addStaff} disabled={submitting || !form.location_id || !form.full_name} style={{ ...gradientBtnStyle, opacity:submitting?0.7:1 }}>
              {submitting ? "Adding…" : "Add Staff Member"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding:"9px 14px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none" };
const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };
const inputStyle: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none", boxSizing:"border-box" as const };
const gradientBtnStyle: React.CSSProperties = { padding:"11px 20px", borderRadius:10, border:"none", background:"linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)", color:"white", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(167,139,250,0.35)" };
