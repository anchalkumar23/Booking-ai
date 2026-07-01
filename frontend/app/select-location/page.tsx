"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Lock, Plus, ArrowRight, Building2 } from "lucide-react";
import { apiFetch, HttpError } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/Modal";

interface Location {
  id: string;
  name: string;
  type: string;
  city: string;
  phone: string;
  has_password: boolean;
  is_active: boolean;
}

const TYPE_ICONS: Record<string, string> = { gym: "🏋️", salon: "💇", restaurant: "🍽️" };
const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function SelectLocationContent() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", type: "gym", city: "", phone: "", timezone: "Asia/Kolkata", password: "", confirmPassword: "",
  });

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const locs = await apiFetch<Location[]>("/v1/locations");
      setLocations(locs.filter(l => l.is_active));
      const active = await apiFetch<Location | null>("/v1/locations/active");
      if (active) {
        router.replace("/dashboard");
        return;
      }
    } catch {
      setToast({ message: "Failed to load locations", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  async function enterLocation() {
    if (!selectedId || !password) return;
    setSubmitting(true);
    try {
      await apiFetch("/v1/locations/select", {
        method: "POST",
        body: JSON.stringify({ location_id: selectedId, password }),
      });
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof HttpError ? e.detail.message : "Could not enter location";
      setToast({ message: msg, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function createLocation() {
    if (createForm.password !== createForm.confirmPassword) {
      setToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const loc = await apiFetch<Location>("/v1/locations", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          type: createForm.type,
          city: createForm.city,
          phone: createForm.phone,
          timezone: createForm.timezone,
          password: createForm.password,
        }),
      });
      await apiFetch("/v1/locations/select", {
        method: "POST",
        body: JSON.stringify({ location_id: loc.id, password: createForm.password }),
      });
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof HttpError ? e.detail.message : "Failed to create location";
      setToast({ message: msg, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-secondary/40 px-5 py-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Building2 className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-3xl tracking-tight text-foreground">Select your location</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Choose a business location and enter its password to continue. Each location has its own data, WhatsApp, and AI knowledge base.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading locations…</div>
      ) : locations.length === 0 ? (
        <Card className="w-full max-w-md p-8 text-center">
          <p className="mb-4 text-muted-foreground">No locations yet. Create your first one to get started.</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="mr-2 h-4 w-4" />Create Location</Button>
        </Card>
      ) : (
        <Card className="w-full max-w-md p-6">
          <div className="mb-4 space-y-2">
            <Label>Location</Label>
            <div className="space-y-2">
              {locations.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedId === l.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/60"
                  }`}
                >
                  <span className="text-xl">{TYPE_ICONS[l.type] || "🏢"}</span>
                  <div>
                    <div className="font-medium text-foreground">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.city}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6 space-y-2">
            <Label htmlFor="loc-password">Location password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="loc-password"
                type="password"
                placeholder="Enter location password"
                className="pl-10"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && enterLocation()}
              />
            </div>
          </div>

          <Button
            className="w-full"
            disabled={!selectedId || !password || submitting}
            onClick={enterLocation}
          >
            {submitting ? "Entering…" : "Enter dashboard"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="mr-1 inline h-3.5 w-3.5" />Add another location
            </button>
          </div>
        </Card>
      )}

      {showCreate && (
        <Modal title="Create Location" onClose={() => setShowCreate(false)}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Business Name *</Label>
                <Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Chennai Fitness Hub" />
              </div>
              <div>
                <Label className="mb-1.5 block">Type *</Label>
                <select value={createForm.type} onChange={e => setCreateForm({ ...createForm, type: e.target.value })} className={selectClass}>
                  <option value="gym">🏋️ Gym</option>
                  <option value="salon">💇 Salon</option>
                  <option value="restaurant">🍽️ Restaurant</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">City *</Label>
                <Input value={createForm.city} onChange={e => setCreateForm({ ...createForm, city: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Phone *</Label>
                <Input value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+919876543210" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Location password *</Label>
                <Input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Min 4 characters" />
              </div>
              <div>
                <Label className="mb-1.5 block">Confirm password *</Label>
                <Input type="password" value={createForm.confirmPassword} onChange={e => setCreateForm({ ...createForm, confirmPassword: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <MapPin className="mr-1 inline h-3 w-3" />
              This password protects access to this location&apos;s dashboard.
            </p>
            <Button
              onClick={createLocation}
              disabled={submitting || !createForm.name || !createForm.city || !createForm.phone || createForm.password.length < 4}
              className="w-full"
            >
              {submitting ? "Creating…" : "Create & enter"}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default function SelectLocationPage() {
  return (
    <Suspense>
      <SelectLocationContent />
    </Suspense>
  );
}
