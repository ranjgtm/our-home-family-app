import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHome, type Person } from "@/lib/home-store";
import { Card, LogoMark, Petal, Sprig } from "@/components/AppShell";

const input =
  "mt-1.5 mb-4 w-full rounded-2xl bg-mist px-4 py-3.5 text-base text-ink outline-none border border-ink/15 focus-visible:ring-2 focus-visible:ring-brand";

function Welcome({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-8 mt-6 flex flex-col items-center text-center">
      <LogoMark className="size-16" />
      <div className="relative mt-4 inline-block">
        <h1 className="font-display text-4xl">Our Home</h1>
        <Sprig className="absolute -right-14 -top-1 w-12 text-herb/60" />
      </div>
      <p className="mt-2 text-sm text-ink/55">{subtitle}</p>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message === "Invalid login credentials" ? "Email or password is not right." : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Almost there — check your email and tap the confirmation link, then sign in.");
    }
    setBusy(false);
  };

  return (
    <>
      <Welcome subtitle="A shared home for our little family" />
      <Card tint="lavender">
        <h2 className="mb-4 font-display text-2xl">{mode === "in" ? "Welcome back" : "Create your account"}</h2>
        <form onSubmit={submit}>
          <label className="eyebrow text-ink/40" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <label className="eyebrow text-ink/40" htmlFor="auth-pass">Password</label>
          <input
            id="auth-pass"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
          {msg && <p className="mb-4 rounded-2xl bg-rose/10 p-3 text-sm text-rose">{msg}</p>}
          <button disabled={busy} className="w-full rounded-2xl bg-brand py-4 text-base font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setMsg(null);
          }}
          className="mt-4 w-full text-center text-sm font-semibold text-brand"
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </Card>
    </>
  );
}

function Onboarding() {
  const { refreshMembership, signOut } = useHome();
  const [person, setPerson] = useState<Person>("");
  const [homeName, setHomeName] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [child, setChild] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } =
      mode === "create"
        ? await supabase.rpc("create_household", {
            _person: person,
            _child_name: child || "Little one",
            _home_name: homeName || "Our Home",
          })
        : await supabase.rpc("join_household", { _code: code, _person: person });
    if (error) setMsg(error.message);
    else await refreshMembership();
    setBusy(false);
  };

  return (
    <>
      <Welcome subtitle="Let's set up your family home" />
      <Card tint="peach">
        <form onSubmit={submit}>
          <label className="eyebrow text-ink/40" htmlFor="my-name">My name</label>
          <input
            id="my-name"
            required
            maxLength={40}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="e.g. Ranjana"
            className={input}
          />


          <div className="glass mb-5 flex rounded-2xl p-1">
            {(["create", "join"] as const).map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${mode === m ? "bg-brand text-primary-foreground" : "text-ink/60"}`}
              >
                {m === "create" ? "Start our home" : "Join with code"}
              </button>
            ))}
          </div>

          {mode === "create" ? (
            <>
              <label className="eyebrow text-ink/40" htmlFor="home-name">Our home's name</label>
              <input id="home-name" value={homeName} maxLength={40} onChange={(e) => setHomeName(e.target.value)} placeholder="Our Home" className={input} />
              <label className="eyebrow text-ink/40" htmlFor="child-name">Our little one's name 🌼</label>
              <input id="child-name" value={child} maxLength={40} onChange={(e) => setChild(e.target.value)} placeholder="Little one" className={input} />
              <p className="mb-4 text-xs text-ink/50">Your toddler is part of the home but doesn't need an account.</p>
            </>
          ) : (
            <>
              <label className="eyebrow text-ink/40" htmlFor="invite-code">Invite code</label>
              <input
                id="invite-code"
                required
                value={code}
                maxLength={12}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 4F9A2C1B"
                className={`${input} tracking-widest`}
              />
              <p className="mb-4 text-xs text-ink/50">Ask your partner — it's shown at the bottom of their Home screen.</p>
            </>
          )}

          {msg && <p className="mb-4 rounded-2xl bg-rose/10 p-3 text-sm text-rose">{msg}</p>}
          <button disabled={busy} className="w-full rounded-2xl bg-brand py-4 text-base font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "One moment…" : mode === "create" ? "Create our home" : "Join our home"}
          </button>
        </form>
        <button onClick={() => void signOut()} className="mt-4 w-full text-center text-sm text-ink/50">
          Sign out
        </button>
      </Card>
    </>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { authReady, session, membership, membershipReady } = useHome();
  if (!authReady || (session && !membershipReady)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-ink/40">
        <Petal className="w-5 animate-pulse text-brand/40" rotate={20} />
        <p className="text-sm">Opening Our Home…</p>
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  if (!membership) return <Onboarding />;
  return <>{children}</>;
}
