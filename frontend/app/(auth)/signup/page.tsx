"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { signup, HttpError } from "@/lib/auth";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  if (!inviteToken) {
    return (
      <main className="flex min-h-svh items-center justify-center px-5">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl text-foreground">Invalid invite link</h1>
          <p className="mt-3 text-muted-foreground">Sign up is by invitation only. Contact your administrator for a valid link.</p>
          <Link href="/login" className="mt-6 inline-block text-sm text-primary hover:underline">Back to sign in</Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(email, password, fullName, inviteToken);
      setToast({ message: "Account created! Sign in to continue.", type: "success" });
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      const msg = err instanceof HttpError ? err.detail.message : "Sign up failed";
      setToast({ message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-secondary/40 px-5 py-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="w-full max-w-md">
        <h1 className="font-serif text-3xl tracking-tight text-foreground">Create your account</h1>
        <p className="mt-2 text-muted-foreground">You&apos;ve been invited to Booking AI. Set up your account to get started.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="name" required className="pl-10" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="email" type="email" required className="pl-10" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="password" type="password" required minLength={8} className="pl-10" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account…" : "Create account"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="text-foreground hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
