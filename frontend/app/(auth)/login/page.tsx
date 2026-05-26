"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/auth";
import { HttpError } from "@/lib/api";
import { Toast } from "@/components/Toast";
import styles from "./login.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      router.push("/dashboard");
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
    <div className={styles.page}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}

      <div className={styles.left}>
        <div className={styles.grid} />
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />

        <div className={styles.leftContent}>
          <div className={styles.brandMark}>
            <div className={styles.brandIcon}>B</div>
            <div>
              <div className={styles.brandName}>Booking AI</div>
              <div className={styles.brandTagline}>Automation Platform</div>
            </div>
          </div>

          <h1 className={styles.headline}>
            Automate.<br />
            <span className={styles.headlineAccent}>Engage.</span><br />
            Grow.
          </h1>
          <p className={styles.subheadline}>
            AI-powered voice calls and WhatsApp automation for your gyms, salons &amp; restaurants — all from one dashboard.
          </p>

          <div className={styles.stats}>
            {[
              { icon: "📞", label: "AI Voice Calls", sub: "Inbound & outbound · 3 languages", val: "24/7", cls: styles.iconPink },
              { icon: "💬", label: "WhatsApp Sequences", sub: "4-step automated outreach", val: "Auto", cls: styles.iconTeal },
              { icon: "📅", label: "Smart Booking", sub: "Real-time slot availability", val: "Live", cls: styles.iconIndigo },
              { icon: "📊", label: "Funnel Analytics", sub: "Leads → Booked → Paid", val: "Full", cls: styles.iconAmber },
            ].map(({ icon, label, sub, val, cls }) => (
              <div key={label} className={styles.statRow}>
                <div className={`${styles.statIcon} ${cls}`}>{icon}</div>
                <div className={styles.statInfo}>
                  <div className={styles.statTitle}>{label}</div>
                  <div className={styles.statSub}>{sub}</div>
                </div>
                <div className={styles.statVal}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formWrap}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSubtitle}>Sign in to your admin dashboard to manage your automation platform.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="email">EMAIL ADDRESS</label>
              <div className={styles.fieldInner}>
                <span className={styles.fieldIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@bookingai.com"
                  className={styles.fieldInput}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="password">PASSWORD</label>
              <div className={styles.fieldInner}>
                <span className={styles.fieldIcon}>🔒</span>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={styles.fieldInput}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.rowBetween}>
              <label className={styles.remember}>
                <input type="checkbox" /> Keep me signed in
              </label>
              <a href="#" className={styles.forgot}>Forgot password?</a>
            </div>

            <button type="submit" disabled={loading} className={styles.btn}>
              {loading ? "Signing in…" : "Sign In to Dashboard →"}
            </button>
          </form>

          <div className={styles.divider}>or</div>

          <div className={styles.statusBadge}>
            <span className={styles.dotLive} />
            All systems operational
          </div>

          <p className={styles.footerNote}>
            Secured with 256-bit encryption &nbsp;·&nbsp; Booking AI © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
