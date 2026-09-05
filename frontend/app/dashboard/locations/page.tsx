"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useActiveLocation } from "@/lib/location-context";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MessageCircle, BookOpen, Lock, Dumbbell, Scissors, UtensilsCrossed, Building2, type LucideIcon } from "lucide-react";

interface Location {
  id: string; name: string; type: string; city: string;
  phone: string; timezone: string; is_active: boolean; created_at: string;
  has_password: boolean;
  knowledge_base: string | null;
  whatsapp_connected: boolean;
  whatsapp_display_phone: string | null;
}

const TYPE_ICON: Record<string, LucideIcon> = { gym: Dumbbell, salon: Scissors, restaurant: UtensilsCrossed };
function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICON[type] || Building2;
  return <Icon className={className ?? "h-5 w-5"} strokeWidth={1.75} />;
}
const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function LocationsPage() {
  const { activeLocation, refresh: refreshActive } = useActiveLocation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name:"", type:"gym", city:"", phone:"", timezone:"Asia/Kolkata", password:"" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kbEdit, setKbEdit] = useState("");
  const [passwordEdit, setPasswordEdit] = useState("");
  const [waForm, setWaForm] = useState({ phone_number_id:"", waba_id:"", access_token:"", display_phone:"" });
  const [waModalId, setWaModalId] = useState<string | null>(null);

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
      setForm({name:"",type:"gym",city:"",phone:"",timezone:"Asia/Kolkata",password:""});
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

  async function saveKnowledgeBase(id: string) {
    try {
      await apiFetch(`/v1/locations/${id}`, { method:"PUT", body:JSON.stringify({ knowledge_base: kbEdit }) });
      setToast({message:"Knowledge base saved",type:"success"});
      setEditingId(null);
      fetchData();
      if (activeLocation?.id === id) refreshActive();
    } catch { setToast({message:"Failed to save",type:"error"}); }
  }

  async function savePassword(id: string) {
    if (passwordEdit.length < 4) {
      setToast({ message: "Password must be at least 4 characters", type: "error" });
      return;
    }
    try {
      await apiFetch(`/v1/locations/${id}`, { method:"PUT", body:JSON.stringify({ password: passwordEdit }) });
      setToast({message:"Location password updated",type:"success"});
      setPasswordEdit("");
      fetchData();
    } catch { setToast({message:"Failed to update password",type:"error"}); }
  }

  async function connectWhatsApp(id: string) {
    setSubmitting(true);
    try {
      await apiFetch(`/v1/locations/${id}/whatsapp`, {
        method:"PUT",
        body: JSON.stringify(waForm),
      });
      setToast({message:"WhatsApp connected",type:"success"});
      setWaModalId(null);
      setWaForm({ phone_number_id:"", waba_id:"", access_token:"", display_phone:"" });
      fetchData();
      if (activeLocation?.id === id) refreshActive();
    } catch (e: any) {
      setToast({message:e.detail?.message || "Failed to connect",type:"error"});
    } finally { setSubmitting(false); }
  }

  async function disconnectWhatsApp(id: string) {
    if (!confirm("Disconnect WhatsApp for this location?")) return;
    try {
      await apiFetch(`/v1/locations/${id}/whatsapp`, { method:"DELETE" });
      setToast({message:"WhatsApp disconnected",type:"success"});
      fetchData();
      if (activeLocation?.id === id) refreshActive();
    } catch { setToast({message:"Failed",type:"error"}); }
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">Locations</h1>
          <p className="mt-2 text-muted-foreground">{locations.length} business locations · each has its own WhatsApp &amp; AI knowledge</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Location</Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : locations.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="mb-4 flex justify-center text-muted-foreground"><Building2 className="h-10 w-10" strokeWidth={1.5} /></div>
          <div className="mb-2 font-serif text-lg font-semibold tracking-tight text-foreground">No locations yet</div>
          <Button onClick={() => setShowAdd(true)}>+ Add Location</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {locations.map(l => (
            <Card key={l.id} className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground"><TypeIcon type={l.type} /></div>
                  <div>
                    <div className="font-serif text-base font-semibold tracking-tight text-foreground">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.city}</div>
                  </div>
                </div>
                <StatusBadge status={l.type} />
              </div>

              <div className="mb-4 flex flex-col gap-1 text-sm text-muted-foreground">
                <div>{l.phone}</div>
                <div>{l.timezone}</div>
                {activeLocation?.id === l.id && (
                  <div className="text-xs font-medium text-emerald-600">● Currently active</div>
                )}
              </div>

              <div className="mb-4 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.is_active ? "bg-emerald-50 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
                  {l.is_active ? "Active" : "Inactive"}
                </span>
                {l.is_active && (
                  <Button variant="destructive" size="sm" onClick={() => deactivate(l.id)}>Deactivate</Button>
                )}
              </div>

              {/* WhatsApp */}
              <div className="mb-4 rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </div>
                {l.whatsapp_connected ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-emerald-600 font-medium">Connected</div>
                      <div className="text-xs text-muted-foreground">{l.whatsapp_display_phone || "Number connected"}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => disconnectWhatsApp(l.id)}>Disconnect</Button>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Connect this location&apos;s own WhatsApp Business number.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setWaModalId(l.id)}>Connect WhatsApp</Button>
                      <a href="/whatsapp-setup-guide.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                        Setup guide (PDF)
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Knowledge Base */}
              <div className="mb-4 rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <BookOpen className="h-4 w-4" />
                  AI Knowledge Base
                </div>
                {editingId === l.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs outline-none focus-visible:border-ring"
                      value={kbEdit}
                      onChange={e => setKbEdit(e.target.value)}
                      placeholder="List services, prices, hours, policies… The phone agent uses this for this location only."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveKnowledgeBase(l.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 line-clamp-3 text-xs text-muted-foreground">
                      {l.knowledge_base || "No knowledge base yet. Add services, pricing, and FAQs for the AI agent."}
                    </p>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(l.id); setKbEdit(l.knowledge_base || ""); }}>
                      {l.knowledge_base ? "Edit" : "Add knowledge base"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Location password */}
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lock className="h-4 w-4" />
                  Location Password
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={l.has_password ? "Set new password" : "Set password"}
                    className="h-9 text-xs"
                    value={passwordEdit}
                    onChange={e => setPasswordEdit(e.target.value)}
                  />
                  <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => savePassword(l.id)}>Save</Button>
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
                  <option value="gym">Gym</option>
                  <option value="salon">Salon</option>
                  <option value="restaurant">Restaurant</option>
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
                <Input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="9876543210" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-foreground">Location password *</Label>
              <Input type="password" value={form.password} onChange={e => setForm({...form,password:e.target.value})} placeholder="Min 4 characters" />
            </div>
            <Button onClick={addLocation} disabled={submitting || !form.name || !form.city || !form.phone || form.password.length < 4} className="w-full">
              {submitting ? "Adding…" : "Add Location"}
            </Button>
          </div>
        </Modal>
      )}

      {waModalId && (
        <Modal title="Connect WhatsApp" onClose={() => setWaModalId(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Enter credentials from Meta WhatsApp Business Cloud API. Each location uses its own number.
              Complete Meta Embedded Signup or add credentials from your Meta App Dashboard.
            </p>
            <div>
              <Label className="mb-1.5 block text-sm">Phone Number ID *</Label>
              <Input value={waForm.phone_number_id} onChange={e => setWaForm({...waForm, phone_number_id:e.target.value})} placeholder="From Meta API Setup" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">WABA ID *</Label>
              <Input value={waForm.waba_id} onChange={e => setWaForm({...waForm, waba_id:e.target.value})} placeholder="WhatsApp Business Account ID" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Access Token *</Label>
              <Input type="password" value={waForm.access_token} onChange={e => setWaForm({...waForm, access_token:e.target.value})} placeholder="Permanent access token" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Display phone (optional)</Label>
              <Input value={waForm.display_phone} onChange={e => setWaForm({...waForm, display_phone:e.target.value})} placeholder="9876543210" />
            </div>
            <Button onClick={() => connectWhatsApp(waModalId)} disabled={submitting || !waForm.phone_number_id || !waForm.waba_id || !waForm.access_token} className="w-full">
              {submitting ? "Connecting…" : "Connect WhatsApp"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
