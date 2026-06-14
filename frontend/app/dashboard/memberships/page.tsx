"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Location { id: string; name: string; }
interface Customer { id: string; full_name: string; phone: string; location_id: string; }
interface Membership {
  id: string;
  customer_id: string;
  location_id: string;
  tier: string;
  starts_at: string;
  expires_at: string;
  payment_status: "paid" | "pending" | "overdue";
  renewal_call_sent: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  location_name: string | null;
}

const PAYMENT_STATUSES = ["paid", "pending", "overdue"];
const TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Annual", "Monthly", "Quarterly"];

const selectClass = "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterExpiring, setFilterExpiring] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Membership | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [addForm, setAddForm] = useState({
    customer_id: "", location_id: "", tier: "", starts_at: today, expires_at: "", payment_status: "pending",
  });
  const [editForm, setEditForm] = useState({
    tier: "", starts_at: "", expires_at: "", payment_status: "pending", renewal_call_sent: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLocation) params.set("location_id", filterLocation);
      if (filterStatus) params.set("payment_status", filterStatus);
      if (filterExpiring) params.set("expiring_days", filterExpiring);
      const [ms, locs] = await Promise.all([
        apiFetch<Membership[]>(`/v1/memberships?${params}`),
        apiFetch<Location[]>("/v1/locations"),
      ]);
      setMemberships(ms);
      setLocations(locs);
    } catch {
      setToast({ message: "Failed to load memberships", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filterLocation, filterStatus, filterExpiring]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load customers when location changes in add form
  useEffect(() => {
    if (!addForm.location_id) { setCustomers([]); return; }
    apiFetch<Customer[]>(`/v1/customers?location_id=${addForm.location_id}`)
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, [addForm.location_id]);

  // Stats
  const total = memberships.length;
  const expiringWeek = memberships.filter(m => { const d = daysUntil(m.expires_at); return d >= 0 && d <= 7; }).length;
  const pendingCount = memberships.filter(m => m.payment_status === "pending").length;
  const paidCount = memberships.filter(m => m.payment_status === "paid").length;

  async function addMembership() {
    if (!addForm.customer_id || !addForm.location_id || !addForm.tier || !addForm.expires_at) {
      setToast({ message: "Please fill all required fields", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/v1/memberships", { method: "POST", body: JSON.stringify(addForm) });
      setToast({ message: "Membership added", type: "success" });
      setShowAdd(false);
      setAddForm({ customer_id: "", location_id: "", tier: "", starts_at: today, expires_at: "", payment_status: "pending" });
      fetchData();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to add membership", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(m: Membership) {
    setEditForm({
      tier: m.tier,
      starts_at: m.starts_at,
      expires_at: m.expires_at,
      payment_status: m.payment_status,
      renewal_call_sent: m.renewal_call_sent,
    });
    setShowEdit(m);
  }

  async function saveMembership() {
    if (!showEdit) return;
    setSubmitting(true);
    try {
      await apiFetch(`/v1/memberships/${showEdit.id}`, { method: "PUT", body: JSON.stringify(editForm) });
      setToast({ message: "Membership updated", type: "success" });
      setShowEdit(null);
      fetchData();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to update", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteMembership(id: string, name: string | null) {
    if (!confirm(`Delete membership for ${name || "this customer"}?`)) return;
    try {
      await apiFetch(`/v1/memberships/${id}`, { method: "DELETE" });
      setToast({ message: "Membership deleted", type: "success" });
      fetchData();
    } catch {
      setToast({ message: "Failed to delete", type: "error" });
    }
  }

  async function triggerCall(id: string, name: string | null) {
    try {
      await apiFetch(`/v1/memberships/${id}/trigger-renewal-call`, { method: "POST" });
      setToast({ message: `Renewal call queued for ${name || "customer"}`, type: "success" });
      fetchData();
    } catch (e: any) {
      setToast({ message: e.detail?.message || "Failed to trigger call", type: "error" });
    }
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">Memberships</h1>
          <p className="mt-2 text-muted-foreground">Track and manage all customer memberships</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Membership</Button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-t-[3px] border-t-border p-5 text-center">
          <div className="font-serif text-4xl tracking-tight text-foreground">{total}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Total</div>
        </Card>
        <Card className="border-t-[3px] border-t-emerald-500 p-5 text-center">
          <div className="font-serif text-4xl tracking-tight text-emerald-600">{paidCount}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Paid</div>
        </Card>
        <Card className="border-t-[3px] border-t-amber-500 p-5 text-center">
          <div className="font-serif text-4xl tracking-tight text-amber-600">{pendingCount}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Pending Payment</div>
        </Card>
        <Card className="border-t-[3px] border-t-rose-500 p-5 text-center">
          <div className="font-serif text-4xl tracking-tight text-rose-600">{expiringWeek}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">Expiring This Week</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={`${selectClass} sm:w-auto`}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selectClass} sm:w-auto`}>
          <option value="">All Statuses</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filterExpiring} onChange={e => setFilterExpiring(e.target.value)} className={`${selectClass} sm:w-auto`}>
          <option value="">All Expiry Dates</option>
          <option value="1">Expiring Today</option>
          <option value="3">Expiring in 3 Days</option>
          <option value="7">Expiring This Week</option>
          <option value="30">Expiring This Month</option>
        </select>
        <Button variant="outline" onClick={() => { setFilterLocation(""); setFilterStatus(""); setFilterExpiring(""); }}>
          Reset
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">Loading...</div>
      ) : memberships.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">No memberships found. Add one to get started.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Days Left</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Call Sent</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map(m => {
                const days = daysUntil(m.expires_at);
                const isUrgent = days <= 7 && days >= 0 && m.payment_status !== "paid";
                return (
                  <tr key={m.id} className={`border-b border-border/60 last:border-0 ${isUrgent ? "bg-amber-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{m.customer_name || "—"}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{m.customer_phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3">{m.location_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">{m.tier}</span>
                    </td>
                    <td className="px-4 py-3">{formatDate(m.starts_at)}</td>
                    <td className="px-4 py-3">{formatDate(m.expires_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${days < 0 ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-emerald-600"}`}>
                        {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={m.payment_status} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${m.renewal_call_sent ? "font-semibold text-emerald-600" : "text-muted-foreground"}`}>
                        {m.renewal_call_sent ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openEdit(m)}>Edit</Button>
                        {m.payment_status !== "paid" && (
                          <Button variant="secondary" size="sm" onClick={() => triggerCall(m.id, m.customer_name)}
                            title="Trigger renewal call now">
                            Call
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => deleteMembership(m.id, m.customer_name)}>
                          Del
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Add Membership" onClose={() => setShowAdd(false)}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Location *</label>
              <select value={addForm.location_id} onChange={e => setAddForm(f => ({ ...f, location_id: e.target.value, customer_id: "" }))} className={selectClass}>
                <option value="">Select location…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Customer *</label>
              <select value={addForm.customer_id} onChange={e => setAddForm(f => ({ ...f, customer_id: e.target.value }))} className={selectClass} disabled={!addForm.location_id}>
                <option value="">{addForm.location_id ? "Select customer…" : "Select location first"}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tier *</label>
              <Input
                list="tiers-list"
                value={addForm.tier}
                onChange={e => setAddForm(f => ({ ...f, tier: e.target.value }))}
                placeholder="e.g. Gold, Monthly, Annual"
              />
              <datalist id="tiers-list">{TIERS.map(t => <option key={t} value={t} />)}</datalist>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Start Date *</label>
              <Input type="date" value={addForm.starts_at} onChange={e => setAddForm(f => ({ ...f, starts_at: e.target.value }))} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Expiry Date *</label>
              <Input type="date" value={addForm.expires_at} onChange={e => setAddForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Payment Status</label>
              <select value={addForm.payment_status} onChange={e => setAddForm(f => ({ ...f, payment_status: e.target.value }))} className={selectClass}>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            <div className="mt-2 flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={addMembership} disabled={submitting}>
                {submitting ? "Saving…" : "Add Membership"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <Modal title={`Edit — ${showEdit.customer_name || "Membership"}`} onClose={() => setShowEdit(null)}>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tier</label>
              <Input
                list="tiers-list-edit"
                value={editForm.tier}
                onChange={e => setEditForm(f => ({ ...f, tier: e.target.value }))}
              />
              <datalist id="tiers-list-edit">{TIERS.map(t => <option key={t} value={t} />)}</datalist>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Start Date</label>
              <Input type="date" value={editForm.starts_at} onChange={e => setEditForm(f => ({ ...f, starts_at: e.target.value }))} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Expiry Date</label>
              <Input type="date" value={editForm.expires_at} onChange={e => setEditForm(f => ({ ...f, expires_at: e.target.value }))} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Payment Status</label>
              <select value={editForm.payment_status} onChange={e => setEditForm(f => ({ ...f, payment_status: e.target.value as any }))} className={selectClass}>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={editForm.renewal_call_sent} onChange={e => setEditForm(f => ({ ...f, renewal_call_sent: e.target.checked }))} />
              Mark Renewal Call Sent
            </label>

            <div className="mt-2 flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button onClick={saveMembership} disabled={submitting}>
                {submitting ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
