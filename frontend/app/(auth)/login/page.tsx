"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, PhoneCall, MessageSquareText, CalendarCheck, BarChart3 } from "lucide-react";
import { login } from "@/lib/auth";
import { HttpError } from "@/lib/api";
import { Toast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const features = [
  { icon: PhoneCall, title: "AI Voice Calls", description: "Inbound & outbound · 3 languages", tag: "24/7" },
  { icon: MessageSquareText, title: "WhatsApp Sequences", description: "4-step automated outreach", tag: "Auto" },
  { icon: CalendarCheck, title: "Smart Booking", description: "Real-time slot availability", tag: "Live" },
  { icon: BarChart3, title: "Funnel Analytics", description: "Leads → Booked → Paid", tag: "Full" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (searchParams.get("session") === "expired") {
      setToast({ message: "Your session expired. Please sign in again.", type: "error" });
    }
  }, [searchParams]);

  const dismissToast = useCallback(() => setToast(null), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/select-location");
    } catch (err) {
      if (err instanceof HttpError) {
        setToast({ message: err.detail.message, type: "error" });
      } else {
        setToast({ message: "Service temporarily unavailable. Try again shortly.", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:h-svh lg:grid-cols-2 lg:overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}

      {/* Feature panel */}
      <section className="relative hidden overflow-hidden border-r border-border bg-secondary/40 lg:flex lg:flex-col lg:overflow-y-auto">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 80% at 30% 40%, black 40%, transparent 100%)",
          }}
        />

        <div className="relative flex flex-1 flex-col justify-center px-10 py-8 xl:px-16">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="font-serif text-lg font-semibold leading-none">D</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">Dusk AI</p>
              <p className="text-xs text-muted-foreground">Automation Platform</p>
            </div>
          </div>

          <h1 className="mt-10 font-serif text-5xl leading-[1.05] tracking-tight text-foreground xl:text-6xl">
            Automate.
            <br />
            <span className="italic">Engage.</span>
            <br />
            Grow.
          </h1>

          <p className="mt-5 max-w-sm text-pretty leading-relaxed text-muted-foreground">
            AI-powered voice calls and WhatsApp automation for your gyms, salons &amp; restaurants — all from one dashboard.
          </p>

          <ul className="mt-8 max-w-lg space-y-2.5">
            {features.map((feature) => (
              <li key={feature.title} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <feature.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{feature.description}</p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{feature.tag}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sign-in form */}
      <section className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <span className="font-serif text-lg font-semibold leading-none">D</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">Dusk AI</p>
              <p className="text-xs text-muted-foreground">Automation Platform</p>
            </div>
          </div>

          <h2 className="font-serif text-4xl tracking-tight text-foreground">Welcome back</h2>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            Sign in to your admin dashboard to manage your automation platform.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@duskai.net"
                  className="h-12 rounded-xl pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Password
                </Label>
                <span className="text-xs text-muted-foreground">
                  Forgot password? Ask your admin for a reset link.
                </span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 rounded-xl px-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="group h-12 w-full rounded-xl text-sm font-semibold">
              {loading ? "Signing in…" : "Sign in to dashboard"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </Button>
          </form>

          <div className="my-7 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-foreground">All systems operational</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Secured with 256-bit encryption · Dusk AI © 2026
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
