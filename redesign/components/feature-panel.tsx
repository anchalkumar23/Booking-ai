import { PhoneCall, MessageSquareText, CalendarCheck, BarChart3 } from "lucide-react"

const features = [
  {
    icon: PhoneCall,
    title: "AI Voice Calls",
    description: "Inbound & outbound · 3 languages",
    tag: "24/7",
  },
  {
    icon: MessageSquareText,
    title: "WhatsApp Sequences",
    description: "4-step automated outreach",
    tag: "Auto",
  },
  {
    icon: CalendarCheck,
    title: "Smart Booking",
    description: "Real-time slot availability",
    tag: "Live",
  },
  {
    icon: BarChart3,
    title: "Funnel Analytics",
    description: "Leads → Booked → Paid",
    tag: "Full",
  },
]

export function FeaturePanel() {
  return (
    <section className="relative hidden overflow-hidden border-r border-border bg-secondary/40 lg:flex lg:flex-col">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 30% 40%, black 40%, transparent 100%)",
        }}
      />

      <div className="relative flex flex-1 flex-col justify-center px-10 py-12 xl:px-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-serif text-lg font-semibold leading-none">B</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Booking AI</p>
            <p className="text-xs text-muted-foreground">Automation Platform</p>
          </div>
        </div>

        {/* Headline */}
        <h1 className="mt-14 font-serif text-6xl leading-[1.05] tracking-tight text-foreground xl:text-7xl">
          Automate.
          <br />
          <span className="italic">Engage.</span>
          <br />
          Grow.
        </h1>

        <p className="mt-7 max-w-sm text-pretty leading-relaxed text-muted-foreground">
          AI-powered voice calls and WhatsApp automation for your gyms, salons &
          restaurants — all from one dashboard.
        </p>

        {/* Feature cards */}
        <ul className="mt-10 max-w-lg space-y-3">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                <feature.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">{feature.tag}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
