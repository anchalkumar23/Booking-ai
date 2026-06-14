"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

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

  async function deleteStaff(id: string, name: string) {
    if (!confirm(`Delete staff member "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/v1/staff/${id}`, { method:"DELETE" });
      setToast({message:"Staff deleted",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed to delete",type:"error"}); }
  }

  const locationName = (id: string) => locations.find(l => l.id === id)?.name || "—";

  function hoursDisplay(wh: Record<string,any>) {
    return DAYS.filter(d => wh[d]).map(d => `${DAY_LABELS[d]} ${wh[d].start}-${wh[d].end}`).join(" · ") || "No hours set";
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">👤 Staff</h1>
          <p className="mt-2 text-muted-foreground">Manage staff members and their working hours</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Staff</Button>
      </div>

      <div className="mb-5 flex gap-3">
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={cn(selectClass, "sm:w-56")}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? <div className="text-muted-foreground">Loading…</div> :
        staff.length === 0 ? <div className="text-muted-foreground">No staff found.</div> :
        staff.map(s => (
          <Card key={s.id} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-serif text-base font-semibold text-foreground">{s.full_name}</div>
                <div className="text-xs text-muted-foreground">{locationName(s.location_id)} · {s.phone || "No phone"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-secondary text-muted-foreground"
                )}>
                  {s.is_active ? "Active" : "Inactive"}
                </span>
                {s.is_active && (
                  <Button size="sm" variant="destructive" onClick={() => deactivate(s.id)}>Deactivate</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => deleteStaff(s.id, s.full_name)}>Delete</Button>
              </div>
            </div>
            <div className="rounded-lg bg-secondary/60 px-3 py-2 text-xs leading-loose text-muted-foreground">
              {hoursDisplay(s.working_hours)}
            </div>
          </Card>
        ))}
      </div>

      {showAdd && (
        <Modal title="Add Staff Member" onClose={() => setShowAdd(false)} width={560}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Location *</label>
              <select value={form.location_id} onChange={e => setForm({...form,location_id:e.target.value})} className={selectClass}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name *</label>
                <Input value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Phone</label>
                <Input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Working Hours — click day to toggle on/off</label>
              <div className="flex flex-col gap-2">
                {DAYS.map(day => (
                  <div key={day} className="flex items-center gap-2.5">
                    <button
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "w-12 shrink-0 rounded-lg border py-1.5 text-xs font-semibold",
                        form.working_hours[day]
                          ? "border-violet-300 bg-violet-50 text-violet-700"
                          : "border-border bg-secondary/50 text-muted-foreground"
                      )}
                    >
                      {DAY_LABELS[day]}
                    </button>
                    {form.working_hours[day] ? (
                      <>
                        <Input
                          type="time"
                          value={form.working_hours[day].start}
                          onChange={e => setForm({...form,working_hours:{...form.working_hours,[day]:{...form.working_hours[day],start:e.target.value}}})}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={form.working_hours[day].end}
                          onChange={e => setForm({...form,working_hours:{...form.working_hours,[day]:{...form.working_hours[day],end:e.target.value}}})}
                          className="w-32"
                        />
                      </>
                    ) : <span className="text-sm text-muted-foreground">Day off</span>}
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={addStaff} disabled={submitting || !form.location_id || !form.full_name}>
              {submitting ? "Adding…" : "Add Staff Member"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
