"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import styles from "./memberships.module.css";

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
    <div className={styles.page}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Memberships</h1>
          <p className={styles.subtitle}>Track and manage all customer memberships</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(true)}>+ Add Membership</button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{total}</div>
          <div className={styles.statLabel}>Total</div>
        </div>
        <div className={`${styles.statCard} ${styles.statPaid}`}>
          <div className={styles.statValue}>{paidCount}</div>
          <div className={styles.statLabel}>Paid</div>
        </div>
        <div className={`${styles.statCard} ${styles.statPending}`}>
          <div className={styles.statValue}>{pendingCount}</div>
          <div className={styles.statLabel}>Pending Payment</div>
        </div>
        <div className={`${styles.statCard} ${styles.statExpiring}`}>
          <div className={styles.statValue}>{expiringWeek}</div>
          <div className={styles.statLabel}>Expiring This Week</div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={styles.select}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={styles.select}>
          <option value="">All Statuses</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filterExpiring} onChange={e => setFilterExpiring(e.target.value)} className={styles.select}>
          <option value="">All Expiry Dates</option>
          <option value="1">Expiring Today</option>
          <option value="3">Expiring in 3 Days</option>
          <option value="7">Expiring This Week</option>
          <option value="30">Expiring This Month</option>
        </select>
        <button className={styles.resetBtn} onClick={() => { setFilterLocation(""); setFilterStatus(""); setFilterExpiring(""); }}>
          Reset
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : memberships.length === 0 ? (
        <div className={styles.empty}>No memberships found. Add one to get started.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Location</th>
                <th>Tier</th>
                <th>Start</th>
                <th>Expiry</th>
                <th>Days Left</th>
                <th>Status</th>
                <th>Call Sent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map(m => {
                const days = daysUntil(m.expires_at);
                const isUrgent = days <= 7 && days >= 0 && m.payment_status !== "paid";
                return (
                  <tr key={m.id} className={isUrgent ? styles.urgentRow : ""}>
                    <td>
                      <div className={styles.customerName}>{m.customer_name || "—"}</div>
                      <div className={styles.customerPhone}>{m.customer_phone || "—"}</div>
                    </td>
                    <td>{m.location_name || "—"}</td>
                    <td><span className={styles.tierBadge}>{m.tier}</span></td>
                    <td>{formatDate(m.starts_at)}</td>
                    <td>{formatDate(m.expires_at)}</td>
                    <td>
                      <span className={days < 0 ? styles.expired : days <= 7 ? styles.soonExpiry : styles.okExpiry}>
                        {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d`}
                      </span>
                    </td>
                    <td><StatusBadge status={m.payment_status} /></td>
                    <td>
                      <span className={m.renewal_call_sent ? styles.callSent : styles.callNotSent}>
                        {m.renewal_call_sent ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => openEdit(m)}>Edit</button>
                        {m.payment_status !== "paid" && (
                          <button className={styles.callBtn} onClick={() => triggerCall(m.id, m.customer_name)}
                            title="Trigger renewal call now">
                            Call
                          </button>
                        )}
                        <button className={styles.deleteBtn} onClick={() => deleteMembership(m.id, m.customer_name)}>
                          Del
                        </button>
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
          <div className={styles.form}>
            <label>Location *</label>
            <select value={addForm.location_id} onChange={e => setAddForm(f => ({ ...f, location_id: e.target.value, customer_id: "" }))} className={styles.input}>
              <option value="">Select location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>

            <label>Customer *</label>
            <select value={addForm.customer_id} onChange={e => setAddForm(f => ({ ...f, customer_id: e.target.value }))} className={styles.input} disabled={!addForm.location_id}>
              <option value="">{addForm.location_id ? "Select customer…" : "Select location first"}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>)}
            </select>

            <label>Tier *</label>
            <input
              list="tiers-list"
              value={addForm.tier}
              onChange={e => setAddForm(f => ({ ...f, tier: e.target.value }))}
              placeholder="e.g. Gold, Monthly, Annual"
              className={styles.input}
            />
            <datalist id="tiers-list">{TIERS.map(t => <option key={t} value={t} />)}</datalist>

            <label>Start Date *</label>
            <input type="date" value={addForm.starts_at} onChange={e => setAddForm(f => ({ ...f, starts_at: e.target.value }))} className={styles.input} />

            <label>Expiry Date *</label>
            <input type="date" value={addForm.expires_at} onChange={e => setAddForm(f => ({ ...f, expires_at: e.target.value }))} className={styles.input} />

            <label>Payment Status</label>
            <select value={addForm.payment_status} onChange={e => setAddForm(f => ({ ...f, payment_status: e.target.value }))} className={styles.input}>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={addMembership} disabled={submitting}>
                {submitting ? "Saving…" : "Add Membership"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <Modal title={`Edit — ${showEdit.customer_name || "Membership"}`} onClose={() => setShowEdit(null)}>
          <div className={styles.form}>
            <label>Tier</label>
            <input
              list="tiers-list-edit"
              value={editForm.tier}
              onChange={e => setEditForm(f => ({ ...f, tier: e.target.value }))}
              className={styles.input}
            />
            <datalist id="tiers-list-edit">{TIERS.map(t => <option key={t} value={t} />)}</datalist>

            <label>Start Date</label>
            <input type="date" value={editForm.starts_at} onChange={e => setEditForm(f => ({ ...f, starts_at: e.target.value }))} className={styles.input} />

            <label>Expiry Date</label>
            <input type="date" value={editForm.expires_at} onChange={e => setEditForm(f => ({ ...f, expires_at: e.target.value }))} className={styles.input} />

            <label>Payment Status</label>
            <select value={editForm.payment_status} onChange={e => setEditForm(f => ({ ...f, payment_status: e.target.value as any }))} className={styles.input}>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>

            <label className={styles.checkLabel}>
              <input type="checkbox" checked={editForm.renewal_call_sent} onChange={e => setEditForm(f => ({ ...f, renewal_call_sent: e.target.checked }))} />
              Mark Renewal Call Sent
            </label>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowEdit(null)}>Cancel</button>
              <button className={styles.saveBtn} onClick={saveMembership} disabled={submitting}>
                {submitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
