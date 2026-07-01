"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { resetPassword, HttpError } from "@/lib/auth";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  if (!token) {
    return (
      <main className="flex min-h-svh items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl text-foreground">Invalid reset link</h1>
          <p className="mt-3 text-muted-foreground">This password reset link is missing or invalid. Ask your administrator for a new one.</p>
          <Link href="/login" className="mt-6 inline-block text-sm text-primary hover:underline">Back to sign in</Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setToast({ message: "Passwords do not match", type: "error" });
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setToast({ message: "Password updated! Redirecting to sign in…", type: "success" });
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      const msg = err instanceof HttpError ? err.detail.message : "Reset failed";
      setToast({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-secondary/40 px-5 py-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="w-full max-w-md">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">Set new password</h1>
        <p className="mt-2 text-muted-foreground">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" required minLength={8} className="pl-10" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirm" type="password" required minLength={8} className="pl-10" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating…" : "Update password"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
