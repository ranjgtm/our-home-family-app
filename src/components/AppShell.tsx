import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Home, ShoppingBasket, UtensilsCrossed, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { initials, useHome } from "@/lib/home-store";

const TABS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/shopping", label: "Shopping", Icon: ShoppingBasket },
  { to: "/meals", label: "Meals", Icon: UtensilsCrossed },
  { to: "/expenses", label: "Expenses", Icon: Wallet },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
] as const;

/** A single soft petal shape. */
export function Petal({ className = "", rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <svg viewBox="0 0 20 32" className={className} style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M10 1C16 8 18 18 10 31C2 18 4 8 10 1Z" fill="currentColor" />
      <path d="M10 5V27" stroke="currentColor" strokeOpacity=".35" strokeWidth="0.8" fill="none" className="mix-blend-multiply" />
    </svg>
  );
}

/** Tiny hand-drawn branch for headers. */
export function Sprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} fill="none" aria-hidden>
      <path d="M2 20C18 16 34 12 62 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M18 16C17 10 21 7 24 6C24 11 22 14 18 16Z" fill="currentColor" opacity=".7" />
      <path d="M30 13C33 17 37 18 40 17C38 13 34 12 30 13Z" fill="currentColor" opacity=".55" />
      <path d="M42 9C41 4 44 1 47 0C47 4 46 7 42 9Z" fill="currentColor" opacity=".7" />
    </svg>
  );
}

/** Our Home mark: tiny house whose roof sprouts a leaf. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-label="Our Home">
      <rect width="40" height="40" rx="12" className="fill-brand" />
      <path d="M11 20L20 12L29 20V29H11Z" fill="none" className="stroke-primary-foreground" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 29C20 24 22 21 26 20C26 25 23.5 28 20 29Z" className="fill-peach" />
      <circle cx="17" cy="24.5" r="1.6" className="fill-primary-foreground" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { membership } = useHome();

  return (
    <div className="app-gradient relative min-h-screen w-full overflow-hidden font-sans text-ink">
      {/* Very subtle drifting petals */}
      <Petal className="pointer-events-none absolute top-24 right-8 w-5 text-rose/15" rotate={35} />
      <Petal className="pointer-events-none absolute top-[28rem] left-4 w-4 text-brand/15" rotate={-20} />
      <Petal className="pointer-events-none absolute top-[48rem] right-10 w-6 text-herb/15" rotate={70} />
      <Petal className="pointer-events-none absolute top-[70rem] left-12 w-4 text-accent/20" rotate={10} />

      <div className="relative mx-auto max-w-md px-5 pt-8 pb-[calc(9rem+env(safe-area-inset-bottom))]">{children}</div>

      {membership && (
      <div className="fixed bottom-0 inset-x-0 z-20">
        <div className="mx-auto max-w-md px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <nav className="glass flex items-center justify-between rounded-[1.75rem] px-2 py-2">
            {TABS.map(({ to, label, Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors ${
                    active ? "bg-brand-soft/70 text-brand" : "text-ink/50"
                  }`}
                >
                  {active && <Petal className="absolute -top-1.5 w-2 text-rose/70" rotate={180} />}
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                  <span className={`text-[10px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="relative mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <LogoMark className="size-6" />
          <p className="eyebrow truncate text-brand/80">{eyebrow}</p>
        </div>
        <div className="relative inline-block">
          <h1 className="font-display text-[2rem] leading-tight">{title}</h1>
          <Sprig className="absolute -right-14 -top-1 w-12 text-herb/60" />
        </div>
      </div>
      {right}
    </div>
  );
}

export function Avatars() {
  const { adults, household } = useHome();
  const ring = "ring-2 ring-surface";
  return (
    <div className="flex -space-x-3">
      {adults.map((a, i) => (
        <div
          key={a}
          title={a}
          className={`grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold ${ring} ${
            i === 1 ? "bg-peach text-accent" : "bg-brand-soft text-brand"
          }`}
        >
          {initials(a)}
        </div>
      ))}
      <div title={household?.childName ?? "Our little one"} className={`grid size-11 shrink-0 place-items-center rounded-full bg-herb/20 text-base ${ring}`}>
        🌼
      </div>
    </div>
  );
}

type Tint = "none" | "lavender" | "sage" | "peach" | "rose";
const TINTS: Record<Tint, string> = {
  none: "",
  lavender: "bg-brand-soft/35",
  sage: "bg-herb/10",
  peach: "bg-peach/40",
  rose: "bg-rose/8",
};

export function Card({ children, className = "", tint = "none" }: { children: ReactNode; className?: string; tint?: Tint }) {
  return (
    <div className={`glass relative overflow-hidden rounded-[1.75rem] p-5 ${TINTS[tint]} ${className}`}>
      <Petal className="pointer-events-none absolute -top-2 -right-1 w-4 text-rose/15" rotate={40} />
      {children}
    </div>
  );
}
