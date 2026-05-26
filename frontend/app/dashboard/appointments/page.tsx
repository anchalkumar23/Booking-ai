"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";

interface Location { id: string; name: string; }
interface Customer { id: string; full_name: string; phone: string; }
interface Staff { id: string; full_name: string; }
interface Slot { time: string; datetime: string; available_staff: number; }
interface Appointment {
  id: string; service: string; scheduled_at: string;
  duration_mins: number; status: string; booked_via: string;
  reminder_sent: boolean; staff_id: string | null;
  customer_id: string; location_id: string; gcal_event_id: string | null;
}

const SERVICES = ["Gym Session", "Personal Training", "Yoga", "Haircut", "Facial", "Massage", "Dining Reservation", "Other"];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showBook, setShowBook] = useState(false);
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({ customer_id:"", location_id:"", service:"Gym Session", date:"", slot:"", duration_mins:60 });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLocation) params.set("location_id", filterLocation);
      if (filterDate) params.set("date", new Date(filterDate).toISOString());
      if (filterStatus) params.set("status", filterStatus);
      const [appts, locs, custs] = await Promise.all([
        apiFetch<Appointment[]>(`/v1/appointments?${params}`),
        apiFetch<Location[]>("/v1/locations"),
        apiFetch<Customer[]>("/v1/customers"),
      ]);
      setAppointments(appts);
      setLocations(locs);
      setCustomers(custs);
    } catch { setToast({message:"Failed to load data",type:"error"}); }
    finally { setLoading(false); }
  }, [filterLocation, filterDate, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function fetchSlots() {
    if (!form.location_id || !form.date) return;
    setLoadingSlots(true);
    try {
      const date = new Date(form.date).toISOString();
      const data = await apiFetch<Slot[]>(`/v1/appointments/slots?location_id=${form.location_id}&date=${date}&duration_mins=${form.duration_mins}`);
      setSlots(data);
    } catch { setToast({message:"Could not fetch slots",type:"error"}); }
    finally { setLoadingSlots(false); }
  }

  useEffect(() => { if (form.location_id && form.date) fetchSlots(); }, [form.location_id, form.date, form.duration_mins]);

  async function bookAppointment() {
    if (!form.customer_id || !form.slot) return;
    setSubmitting(true);
    try {
      await apiFetch("/v1/appointments", {
        method: "POST",
        body: JSON.stringify({
          customer_id: form.customer_id,
          location_id: form.location_id,
          service: form.service,
          scheduled_at: form.slot,
          duration_mins: form.duration_mins,
          booked_via: "dashboard",
        }),
      });
      setToast({message:"Appointment booked successfully",type:"success"});
      setShowBook(false);
      setForm({customer_id:"",location_id:"",service:"Gym Session",date:"",slot:"",duration_mins:60});
      fetchData();
    } catch (e: any) {
      setToast({message: e.detail?.message || "Booking failed",type:"error"});
    } finally { setSubmitting(false); }
  }

  async function cancelAppointment(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await apiFetch(`/v1/appointments/${id}/cancel`, { method: "PATCH" });
      setToast({message:"Appointment cancelled",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed to cancel",type:"error"}); }
  }

  function customerName(id: string) {
    return customers.find(c => c.id === id)?.full_name || "—";
  }
  function locationName(id: string) {
    return locations.find(l => l.id === id)?.name || "—";
  }

  return (
    <div style={{ padding: 32, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#0f172a", marginBottom:4 }}>
            📅 Appointments
          </h1>
          <p style={{ fontSize:14, color:"#94a3b8" }}>Book, manage and track all appointments</p>
        </div>
        <button onClick={() => setShowBook(true)} style={{
          padding:"10px 20px", borderRadius:10, border:"none",
          background:"linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)",
          color:"white", fontFamily:"'Syne',sans-serif", fontWeight:700,
          fontSize:13, cursor:"pointer", boxShadow:"0 4px 16px rgba(167,139,250,0.35)",
        }}>+ Book Appointment</button>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={selectStyle}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={selectStyle} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {["scheduled","completed","cancelled","no_show"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>
        <button onClick={fetchData} style={{ ...selectStyle, background:"#f1f5f9", cursor:"pointer", border:"none", fontWeight:600 }}>
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ background:"white", borderRadius:16, border:"1px solid #edf1f7", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>Loading…</div>
        ) : appointments.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>No appointments found. Book one to get started.</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc", borderBottom:"1px solid #edf1f7" }}>
                {["Customer","Location","Service","Date & Time","Duration","Status","Booked Via","Actions"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontWeight:600, color:"#64748b", fontSize:11, letterSpacing:"0.04em", textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a, i) => (
                <tr key={a.id} style={{ borderBottom:"1px solid #f1f5f9", background: i%2===0?"white":"#fafbff" }}>
                  <td style={tdStyle}><b style={{color:"#0f172a"}}>{customerName(a.customer_id)}</b></td>
                  <td style={tdStyle}>{locationName(a.location_id)}</td>
                  <td style={tdStyle}>{a.service}</td>
                  <td style={tdStyle}>{new Date(a.scheduled_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})}</td>
                  <td style={tdStyle}>{a.duration_mins} min</td>
                  <td style={tdStyle}><StatusBadge status={a.status} /></td>
                  <td style={tdStyle}><StatusBadge status={a.booked_via} /></td>
                  <td style={tdStyle}>
                    {a.status === "scheduled" && (
                      <button onClick={() => cancelAppointment(a.id)} style={dangerBtnStyle}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Book Modal */}
      {showBook && (
        <Modal title="Book Appointment" onClose={() => setShowBook(false)} width={540}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={labelStyle}>Customer</label>
              <select value={form.customer_id} onChange={e => setForm({...form, customer_id:e.target.value})} style={inputStyle}>
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <select value={form.location_id} onChange={e => setForm({...form, location_id:e.target.value, slot:""})} style={inputStyle}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Service</label>
              <select value={form.service} onChange={e => setForm({...form, service:e.target.value})} style={inputStyle}>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value, slot:""})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Duration (mins)</label>
                <select value={form.duration_mins} onChange={e => setForm({...form, duration_mins:+e.target.value, slot:""})} style={inputStyle}>
                  {[30,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Available Slot {loadingSlots && <span style={{color:"#a78bfa"}}>loading…</span>}</label>
              <select value={form.slot} onChange={e => setForm({...form, slot:e.target.value})} style={inputStyle}>
                <option value="">Select a slot…</option>
                {slots.map(s => <option key={s.datetime} value={s.datetime}>{s.time} ({s.available_staff} staff free)</option>)}
              </select>
              {form.location_id && form.date && slots.length === 0 && !loadingSlots && (
                <p style={{fontSize:12,color:"#ef4444",marginTop:4}}>No slots available on this date.</p>
              )}
            </div>
            <button
              onClick={bookAppointment}
              disabled={submitting || !form.customer_id || !form.slot}
              style={{ ...gradientBtnStyle, opacity: submitting || !form.customer_id || !form.slot ? 0.6 : 1 }}
            >
              {submitting ? "Booking…" : "Confirm Booking"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding:"9px 14px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none" };
const tdStyle: React.CSSProperties = { padding:"12px 16px", color:"#475569" };
const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6, letterSpacing:"0.02em" };
const inputStyle: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1.5px solid #e8edf5", borderRadius:10, fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, color:"#0f172a", background:"white", outline:"none", boxSizing:"border-box" };
const dangerBtnStyle: React.CSSProperties = { padding:"5px 12px", borderRadius:7, border:"1.5px solid #fca5a5", background:"#fef2f2", color:"#b91c1c", fontSize:12, fontWeight:600, cursor:"pointer" };
const gradientBtnStyle: React.CSSProperties = { padding:"13px", borderRadius:10, border:"none", background:"linear-gradient(90deg,#f472b6,#a78bfa,#60a5fa)", color:"white", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 4px 16px rgba(167,139,250,0.35)" };
