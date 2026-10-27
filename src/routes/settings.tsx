import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useHome } from "@/lib/home-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account · Our Home" },
      { name: "description", content: "Your name, household, calendar connection and privacy for Our Home." },
      { property: "og:title", content: "Account · Our Home" },
      { property: "og:description", content: "Manage your name, calendar privacy and sign out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});

const field =
  "min-w-0 flex-1 rounded-xl border border-ink/15 bg-mist px-3 py-2.5 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand";

function Settings() {
  const { me, household, renameMe, signOut, membership } = useHome();
  const [name, setName] = useState(me);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [feed, setFeed] = useState<{ show: boolean; synced: string | null } | null | undefined>(undefined);
  const [toggling, setToggling] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => setName(me), [me]);

  useEffect(() => {
    if (!membership) return;
    void supabase
      .from("calendar_feeds")
      .select("show_details, last_synced_at")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setFeed(null);
        else setFeed(data ? { show: data.show_details, synced: data.last_synced_at } : null);
      });
  }, [membership]);

  const saveName = async () => {
    if (saving || !name.trim() || name.trim() === me) return;
    setSaving(true);
    const err = await renameMe(name);
    setSaving(false);
    setMsg(err ? "Couldn't save your name. Please try again." : "Saved 🌿");
  };

  const togglePrivacy = async () => {
    if (!feed || toggling || !membership) return;
    setToggling(true);
    const next = !feed.show;
    const { error } = await supabase
      .from("calendar_feeds")
      .update({ show_details: next })
      .eq("household_id", membership.householdId);
    setToggling(false);
    if (!error) setFeed({ ...feed, show: next });
  };

  return (
    <>
      <PageHeader eyebrow="Just for you" title="Account" />

      <Card className="mb-4" tint="lavender">
        <label className="eyebrow text-ink/40" htmlFor="set-name">My name</label>
        <div className="mt-1.5 flex gap-2">
          <input id="set-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={field} />
          <button
            onClick={() => void saveName()}
            disabled={saving || !name.trim() || name.trim() === me}
            className="min-h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-ink/55">{msg}</p>}
      </Card>

      {household && (
        <Card className="mb-4" tint="peach">
          <p className="eyebrow mb-1 text-ink/40">Household</p>
          <h2 className="font-display text-2xl">{household.name}</h2>
          <p className="mt-1 text-sm text-ink/60">
            {household.members.join(" & ")} · 🌼 {household.childName}
          </p>
          {household.members.length < 2 && (
            <p className="mt-3 text-sm text-ink/60">
              Invite code{" "}
              <span className="rounded-lg bg-brand/10 px-2 py-0.5 font-bold tracking-widest text-brand">{household.inviteCode}</span>
            </p>
          )}
        </Card>
      )}

      <Card className="mb-4" tint="sage">
        <p className="eyebrow mb-1 text-ink/40">Google Calendar</p>
        {feed === undefined ? (
          <p className="text-sm text-ink/50">Checking…</p>
        ) : feed === null ? (
          <p className="text-sm text-ink/60">
            Not connected.{" "}
            <Link to="/calendar" className="font-semibold text-brand underline">Connect on Calendar</Link>
          </p>
        ) : (
          <>
            <p className="text-sm text-ink/60">
              Connected{feed.synced ? ` · last updated ${new Date(feed.synced).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.
            </p>
            <button
              role="switch"
              aria-checked={feed.show}
              onClick={() => void togglePrivacy()}
              disabled={toggling}
              className="mt-4 flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-semibold">Show my event details to household</span>
                <span className="block text-xs text-ink/50">
                  {feed.show ? "Others see your event titles and times." : "Others only see “Busy” and the time."}
                </span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${feed.show ? "bg-herb" : "bg-ink/20"}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-surface transition-all ${feed.show ? "left-6" : "left-1"}`} />
              </span>
            </button>
          </>
        )}
      </Card>

      <button
        onClick={async () => {
          if (signingOut) return;
          setSigningOut(true);
          await signOut();
        }}
        disabled={signingOut}
        className="min-h-12 w-full rounded-2xl border border-rose/30 py-3 text-sm font-semibold text-rose disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : `Sign out (${me})`}
      </button>
    </>
  );
}
