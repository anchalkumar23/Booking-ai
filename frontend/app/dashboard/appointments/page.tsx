"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveLocation } from "@/lib/location-context";

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

const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function AppointmentsPage() {
  const { activeLocation } = useActiveLocation();
  const locationId = activeLocation?.id ?? "";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showBook, setShowBook] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({ customer_id:"", service:"Gym Session", date:"", slot:"", duration_mins:60 });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (filterDate) params.set("date", new Date(filterDate).toISOString());
      if (filterStatus) params.set("status", filterStatus);
      const [appts, custs] = await Promise.all([
        apiFetch<Appointment[]>(`/v1/appointments?${params}`),
        apiFetch<Customer[]>(`/v1/customers?location_id=${locationId}`),
      ]);
      setAppointments(appts);
      setCustomers(custs);
    } catch { setToast({message:"Failed to load data",type:"error"}); }
    finally { setLoading(false); }
  }, [locationId, filterDate, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function fetchSlots() {
    if (!locationId || !form.date) return;
    setLoadingSlots(true);
    try {
      const date = new Date(form.date).toISOString();
      const data = await apiFetch<Slot[]>(`/v1/appointments/slots?location_id=${locationId}&date=${date}&duration_mins=${form.duration_mins}`);
      setSlots(data);
    } catch { setToast({message:"Could not fetch slots",type:"error"}); }
    finally { setLoadingSlots(false); }
  }

  useEffect(() => { if (locationId && form.date) fetchSlots(); }, [locationId, form.date, form.duration_mins]);

  async function bookAppointment() {
    if (!form.customer_id || !form.slot) return;
    setSubmitting(true);
    try {
      await apiFetch("/v1/appointments", {
        method: "POST",
        body: JSON.stringify({
          customer_id: form.customer_id,
          location_id: locationId,
          service: form.service,
          scheduled_at: form.slot,
          duration_mins: form.duration_mins,
          booked_via: "dashboard",
        }),
      });
      setToast({message:"Appointment booked successfully",type:"success"});
      setShowBook(false);
      setForm({customer_id:"",service:"Gym Session",date:"",slot:"",duration_mins:60});
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

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">📅 Appointments</h1>
          <p className="mt-2 text-muted-foreground">Appointments at {activeLocation?.name}</p>
        </div>
        <Button onClick={() => setShowBook(true)}>+ Book Appointment</Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="sm:w-auto" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selectClass} sm:w-auto`}>
          <option value="">All Statuses</option>
          {["scheduled","completed","cancelled","no_show"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
        </select>
        <Button variant="outline" onClick={fetchData}>Refresh</Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">Loading…</div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">No appointments found. Book one to get started.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {["Customer","Service","Date & Time","Duration","Status","Booked Via","Actions"].map(h => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground">{customerName(a.customer_id)}</td>
                  <td className="px-4 py-3">{a.service}</td>
                  <td className="px-4 py-3">{new Date(a.scheduled_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"})}</td>
                  <td className="px-4 py-3">{a.duration_mins} min</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={a.booked_via} /></td>
                  <td className="px-4 py-3">
                    {a.status === "scheduled" && (
                      <Button variant="destructive" size="sm" onClick={() => cancelAppointment(a.id)}>Cancel</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Book Modal */}
      {showBook && (
        <Modal title="Book Appointment" onClose={() => setShowBook(false)} width={540}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Customer</label>
              <select value={form.customer_id} onChange={e => setForm({...form, customer_id:e.target.value})} className={selectClass}>
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Service</label>
              <select value={form.service} onChange={e => setForm({...form, service:e.target.value})} className={selectClass}>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value, slot:""})} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Duration (mins)</label>
                <select value={form.duration_mins} onChange={e => setForm({...form, duration_mins:+e.target.value, slot:""})} className={selectClass}>
                  {[30,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Available Slot {loadingSlots && <span className="text-accent-foreground">loading…</span>}
              </label>
              <select value={form.slot} onChange={e => setForm({...form, slot:e.target.value})} className={selectClass}>
                <option value="">Select a slot…</option>
                {slots.map(s => <option key={s.datetime} value={s.datetime}>{s.time} ({s.available_staff} staff free)</option>)}
              </select>
              {locationId && form.date && slots.length === 0 && !loadingSlots && (
                <p className="mt-1 text-xs text-rose-500">No slots available on this date.</p>
              )}
            </div>
            <Button
              onClick={bookAppointment}
              disabled={submitting || !form.customer_id || !form.slot}
              className="w-full"
            >
              {submitting ? "Booking…" : "Confirm Booking"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
