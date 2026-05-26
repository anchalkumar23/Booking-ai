"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";

interface Location { id: string; name: string; }
interface Customer {
  id: string; full_name: string; phone: string; email: string | null;
  language: string; is_dnd: boolean; is_suppressed: boolean;
  location_id: string; created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ location_id:"", full_name:"", phone:"", email:"", language:"en" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterLocation) params.set("location_id", filterLocation);
      const [c, l] = await Promise.all([
        apiFetch<Customer[]>(`/v1/customers?${params}`),
        apiFetch<Location[]>("/v1/locations"),
      ]);
      setCustomers(c); setLocations(l);
    } catch { setToast({message:"Failed to load",type:"error"}); }
    finally { setLoading(false); }
  }, [search, filterLocation]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addCustomer() {
    setSubmitting(true);
    try {
      await apiFetch("/v1/customers", { method:"POST", body:JSON.stringify({ ...form, email: form.email || undefined }) });
      setToast({message:"Customer added",type:"success"});
      setShowAdd(false);
      setForm({location_id:"",full_name:"",phone:"",email:"",language:"en"});
      fetchData();
    } catch (e: any) {
      setToast({message:e.detail?.message || "Failed",type:"error"});
    } finally { setSubmitting(false); }
  }

  const locationName = (id: string) => locations.find(l => l.id === id)?.name || "—";

  return (
    <div style={{ padding:32, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#0f172a", marginBottom:4 }}>👥 Customers</h1>
          <p style={{ fontSize:14, color:"#94a3b8" }}>{customers.length} customers total</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={gradientBtnStyle}>+ Add Customer</button>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <input placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} style={selectStyle} />
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={selectStyle}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button onClick={fetchData} style={{ ...selectStyle, background:"#f1f5f9", cursor:"pointer", border:"none", fontWeight:600 }}>Refresh</button>
      </div>
      <div style={{ background:"white", borderRadius:16, border:"1px solid #edf1f7", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        {loading ? <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>Loading…</div> :
        customers.length === 0 ? <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>No customers yet.</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc", borderBottom:"1px solid #edf1f7" }}>
                {["Name","Phone","Email","Language","Location","DND","Suppressed","Added"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} style={{ borderBottom:"1px solid #f1f5f9", background:i%2===0?"white":"#fafbff" }}>
                  <td style={tdStyle}><b style={{color:"#0f172a"}}>{c.full_name}</b></td>
                  <td style={tdStyle}>{c.phone}</td>
                  <td style={tdStyle}>{c.email || "—"}</td>
                  <td style={tdStyle}>{c.language.toUpperCase()}</td>
                  <td style={tdStyle}>{locationName(c.location_id)}</td>
                  <td style={tdStyle}>{c.is_dnd ? <span style={{color:"#ef4444",fontWeight:600}}>Yes</span> : "No"}</td>
                  <td style={tdStyle}>{c.is_suppressed ? <span style={{color:"#ef4444",fontWeight:600}}>Yes</span> : "No"}</td>
                  <td style={tdStyle}>{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showAdd && (
        <Modal title="Add Customer" onClose={() => setShowAdd(false)}>
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
              <div><label style={labelStyle}>Phone *</label><input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+91..." style={inputStyle} /></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div><label style={labelStyle}>Email</label><input value={form.email} onChange={e => setForm({...form,email:e.target.value})} type="email" style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Language</label>
                <select value={form.language} onChange={e => setForm({...form,language:e.target.value})} style={inputStyle}>
                  <option value="en">English</option><option value="hi">Hindi</option><option value="ta">Tamil</option>
                </select>
              </div>
            </div>
            <button onClick={addCustomer} disabled={submitting || !form.location_id || !form.full_name || !form.phone} style={{ ...gradientBtnStyle, opacity:submitting?0.7:1 }}>
              {submitting ? "Adding…" : "Add Customer"}
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
const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6 };
const inputStyle: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none", boxSizing:"border-box" as const };
const gradientBtnStyle: React.CSSProperties = { padding:"11px 20px", borderRadius:10, border:"none", background:"linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)", color:"white", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(167,139,250,0.35)" };
