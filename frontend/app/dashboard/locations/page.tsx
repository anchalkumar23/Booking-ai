"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface Location {
  id: string; name: string; type: string; city: string;
  phone: string; timezone: string; is_active: boolean; created_at: string;
  access_code: string | null;
}

const TYPE_ICONS: Record<string, string> = { gym: "🏋️", salon: "💇", restaurant: "🍽️" };
const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name:"", type:"gym", city:"", phone:"", timezone:"Asia/Kolkata", access_code:"" });
  const [codeEdits, setCodeEdits] = useState<Record<string,string>>({});

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
      await apiFetch("/v1/locations", { method:"POST", body:JSON.stringify({...form, access_code: form.access_code || undefined}) });
      setToast({message:"Location added",type:"success"});
      setShowAdd(false);
      setForm({name:"",type:"gym",city:"",phone:"",timezone:"Asia/Kolkata",access_code:""});
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

  async function saveAccessCode(id: string) {
    const code = (codeEdits[id] ?? "").trim();
    try {
      await apiFetch(`/v1/locations/${id}`, { method:"PUT", body:JSON.stringify({ access_code: code }) });
      setToast({message:"Access code updated",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed to update access code",type:"error"}); }
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">🏢 Locations</h1>
          <p className="mt-2 text-muted-foreground">{locations.length} business locations</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Location</Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : locations.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="mb-4 text-5xl">🏢</div>
          <div className="mb-2 font-serif text-lg font-semibold tracking-tight text-foreground">No locations yet</div>
          <div className="mb-5 text-muted-foreground">Add your first gym, salon or restaurant</div>
          <Button onClick={() => setShowAdd(true)}>+ Add Location</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {locations.map(l => (
            <Card key={l.id} className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="text-2xl">{TYPE_ICONS[l.type] || "🏢"}</div>
                  <div>
                    <div className="font-serif text-base font-semibold tracking-tight text-foreground">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.city}</div>
                  </div>
                </div>
                <StatusBadge status={l.type} />
              </div>

              <div className="mb-4 flex flex-col gap-1 text-sm text-muted-foreground">
                <div>📞 {l.phone}</div>
                <div>🕐 {l.timezone}</div>
                <div>📋 ID: <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{l.id.slice(0,8)}…</code></div>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.is_active ? "bg-emerald-50 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
                  {l.is_active ? "Active" : "Inactive"}
                </span>
                {l.is_active && (
                  <Button variant="destructive" size="sm" onClick={() => deactivate(l.id)}>Deactivate</Button>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-foreground">Portal Access Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={codeEdits[l.id] ?? l.access_code ?? ""}
                    onChange={e => setCodeEdits({...codeEdits, [l.id]: e.target.value})}
                    placeholder="Set a code for location staff"
                    className="h-9 text-xs"
                  />
                  <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => saveAccessCode(l.id)}>Save</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Location" onClose={() => setShowAdd(false)}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">Business Name *</Label>
                <Input value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Chennai Fitness Hub" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">Type *</Label>
                <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} className={selectClass}>
                  <option value="gym">🏋️ Gym</option>
                  <option value="salon">💇 Salon</option>
                  <option value="restaurant">🍽️ Restaurant</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">City *</Label>
                <Input value={form.city} onChange={e => setForm({...form,city:e.target.value})} placeholder="Chennai" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm font-medium text-foreground">Phone *</Label>
                <Input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+919876543210" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-foreground">Timezone</Label>
              <select value={form.timezone} onChange={e => setForm({...form,timezone:e.target.value})} className={selectClass}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Chennai">Asia/Chennai</option>
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-foreground">Portal Access Code (optional)</Label>
              <Input value={form.access_code} onChange={e => setForm({...form,access_code:e.target.value})} placeholder="Lets this location's staff log into a scoped portal" />
            </div>
            <Button onClick={addLocation} disabled={submitting || !form.name || !form.city || !form.phone} className="w-full">
              {submitting ? "Adding…" : "Add Location"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
