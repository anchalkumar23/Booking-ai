"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useActiveLocation } from "@/lib/location-context";
import { Toast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Customer {
  id: string; full_name: string; phone: string; email: string | null;
  language: string; is_dnd: boolean; is_suppressed: boolean;
  location_id: string; created_at: string;
}

export default function CustomersPage() {
  const { activeLocation } = useActiveLocation();
  const locationId = activeLocation?.id ?? "";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message:string;type:"error"|"success"}|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name:"", phone:"", email:"", language:"en" });

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (search) params.set("search", search);
      setCustomers(await apiFetch<Customer[]>(`/v1/customers?${params}`));
    } catch { setToast({message:"Failed to load",type:"error"}); }
    finally { setLoading(false); }
  }, [search, locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addCustomer() {
    setSubmitting(true);
    try {
      await apiFetch("/v1/customers", {
        method:"POST",
        body:JSON.stringify({ ...form, location_id: locationId, email: form.email || undefined }),
      });
      setToast({message:"Customer added",type:"success"});
      setShowAdd(false);
      setForm({full_name:"",phone:"",email:"",language:"en"});
      fetchData();
    } catch (e: any) {
      setToast({message:e.detail?.message || "Failed",type:"error"});
    } finally { setSubmitting(false); }
  }

  async function deleteCustomer(id: string, name: string) {
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/v1/customers/${id}`, { method:"DELETE" });
      setToast({message:"Customer deleted",type:"success"});
      fetchData();
    } catch { setToast({message:"Failed to delete",type:"error"}); }
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">Customers</h1>
          <p className="mt-2 text-muted-foreground">{customers.length} customers at {activeLocation?.name}</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Customer</Button>
      </header>

      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-64" />
        <Button variant="secondary" onClick={fetchData}>Refresh</Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">Loading…</div>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground shadow-sm">No customers yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {["Name","Phone","Email","Language","DND","Suppressed","Added",""].map(h => (
                  <th key={h} className="px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-foreground">{c.full_name}</td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.email || "—"}</td>
                  <td className="px-4 py-3">{c.language.toUpperCase()}</td>
                  <td className="px-4 py-3">{c.is_dnd ? <span className="font-semibold text-rose-500">Yes</span> : "No"}</td>
                  <td className="px-4 py-3">{c.is_suppressed ? <span className="font-semibold text-rose-500">Yes</span> : "No"}</td>
                  <td className="px-4 py-3">{new Date(c.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => deleteCustomer(c.id, c.full_name)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add Customer" onClose={() => setShowAdd(false)}>
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name *</label>
                <Input value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Phone *</label>
                <Input value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+91..." />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <Input value={form.email} onChange={e => setForm({...form,email:e.target.value})} type="email" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Language</label>
                <select value={form.language} onChange={e => setForm({...form,language:e.target.value})} className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40">
                  <option value="en">English</option><option value="hi">Hindi</option><option value="ta">Tamil</option>
                </select>
              </div>
            </div>
            <Button onClick={addCustomer} disabled={submitting || !form.full_name || !form.phone} className="w-full">
              {submitting ? "Adding…" : "Add Customer"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
