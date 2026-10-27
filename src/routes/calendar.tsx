import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, useHome } from "@/lib/home-store";
import { syncCalendarFeeds, type FeedEvent } from "@/lib/calendar.functions";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar · Our Home" },
      { name: "description", content: "Both Google Calendars together in one monthly family view." },
      { property: "og:title", content: "Calendar · Our Home" },
      { property: "og:description", content: "See both of your Google Calendars together, month by month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Calendar,
});

const TONE_BG = { brand: "bg-brand text-primary-foreground", accent: "bg-accent text-accent-foreground", herb: "bg-herb text-primary-foreground" } as const;
const TONE_DOT = { brand: "bg-brand", accent: "bg-accent", herb: "bg-herb" } as const;
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fmt = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(Math.min(hh, 23)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const timeLabel = (e: FeedEvent) => (e.allDay || (e.start === 0 && e.end === 24) ? "All day" : `${fmt(e.start)}–${fmt(e.end)}`);
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

function Calendar() {
  const { toneOf, adults, me, membership, session } = useHome();
  const runSync = useServerFn(syncCalendarFeeds);
  const today = isoDate(new Date());

  const [view, setView] = useState<"month" | "schedule">("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedEvent | null>(null);
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  // Link settings
  const [link, setLink] = useState("");
  const [saved, setSaved] = useState(false);
  const [others, setOthers] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  // Grid: Monday before the 1st, 6 weeks.
  const gridStart = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(1 - ((d.getDay() + 6) % 7));
    return d;
  }, [cursor]);
  const gridDays = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return isoDate(d);
      }),
    [gridStart],
  );

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const res =
        view === "month"
          ? await runSync({ data: { weekStart: gridDays[0]!, timeZone: tz(), days: 42 } })
          : await runSync({ data: { weekStart: today, timeZone: tz(), days: 60 } });
      setEvents(res.events);
      setOthers(res.feeds.filter((f) => f.person !== me).map((f) => f.person));
      const failed = res.feeds.filter((f) => !f.ok);
      setStatus(
        failed.length
          ? `Couldn't read ${failed.map((f) => f.person).join(" and ")}'s calendar — check the link.`
          : res.feeds.length
            ? null
            : "No calendars connected yet. Tap Calendar links to add yours.",
      );
    } catch {
      setStatus("Could not update right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [membership, runSync, view, gridDays, today, me]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!membership) return;
    void supabase
      .from("calendar_feeds")
      .select("ics_url")
      .then(({ data }) => {
        const mine = (data ?? [])[0];
        setSaved(!!mine);
        setLink(mine?.ics_url ?? "");
      });
  }, [membership]);

  const saveLink = async () => {
    if (!membership) return;
    const url = link.trim();
    if (!/^(https?|webcal):\/\//i.test(url) || !/\.ics(\?|$)/i.test(url)) {
      setStatus("That doesn't look like a calendar link. It should end in .ics");
      return;
    }
    const { error } = await supabase
      .from("calendar_feeds")
      .upsert({ household_id: membership.householdId, person: me, ics_url: url }, { onConflict: "household_id,user_id" });
    if (error) return setStatus("Could not save your calendar link.");
    setSaved(true);
    setOpen(false);
    await load();
  };
  const removeLink = async () => {
    if (!membership) return;
    await supabase.from("calendar_feeds").delete().eq("household_id", membership.householdId).eq("user_id", session?.user.id ?? "");
    setSaved(false);
    setLink("");
    setOpen(false);
    await load();
  };

  const byDay = useMemo(() => {
    const m = new Map<string, FeedEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    for (const list of m.values()) list.sort((a, b) => a.start - b.start);
    return m;
  }, [events]);

  const monthPrefix = isoDate(cursor).slice(0, 7);
  const monthName = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const tone = (p: string) => toneOf(p);

  return (
    <>
      <PageHeader eyebrow="Both calendars together" title="Calendar" />

      <div className="glass mb-3 flex rounded-2xl p-1">
        {(["month", "schedule"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold ${view === v ? "bg-brand text-primary-foreground" : "text-ink/60"}`}
          >
            {v === "month" ? "Month" : "Schedule"}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-ink/60">
        {adults.map((a) => (
          <span key={a} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${TONE_DOT[tone(a)]}`} /> {a}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-herb" /> Family
        </span>
        {loading && <span className="ml-auto text-ink/40">Updating…</span>}
      </div>

      {view === "month" ? (
        <Card className="mb-4 !p-3">
          <div className="mb-3 flex items-center gap-2">
            <button
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="grid size-9 place-items-center rounded-xl bg-mist text-ink/60"
            >
              ←
            </button>
            <p className="min-w-0 flex-1 truncate text-center font-display text-lg">{monthName}</p>
            <button
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="grid size-9 place-items-center rounded-xl bg-mist text-ink/60"
            >
              →
            </button>
            <button
              onClick={() => {
                const d = new Date();
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              }}
              className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px text-center text-[10px] font-semibold text-ink/40">
            {WD.map((d) => (
              <span key={d} className="pb-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-border">
            {gridDays.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.startsWith(monthPrefix);
              const isToday = d === today;
              return (
                <button
                  key={d}
                  onClick={() => setDayOpen(d)}
                  className={`flex min-h-[4.75rem] min-w-0 flex-col gap-0.5 p-0.5 text-left sm:min-h-[6rem] ${inMonth ? "bg-surface" : "bg-mist/60"}`}
                >
                  <span
                    className={`mx-auto grid size-5 place-items-center rounded-full text-[11px] font-semibold ${
                      isToday ? "bg-brand text-primary-foreground" : inMonth ? "text-ink" : "text-ink/30"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {list.slice(0, 3).map((e, i) => (
                    <span
                      key={i}
                      className={`block truncate rounded px-0.5 text-[9px] leading-[14px] sm:text-[11px] sm:leading-4 ${TONE_BG[tone(e.person)]}`}
                    >
                      <span className="hidden sm:inline">{e.allDay ? "" : `${fmt(e.start)} `}</span>
                      {e.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="text-center text-[9px] font-semibold text-ink/45">+{list.length - 3}</span>}
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          {events.length === 0 && !loading && <p className="text-sm text-ink/45">Nothing coming up in the next 60 days.</p>}
          <div className="space-y-4">
            {[...byDay.entries()]
              .sort((a, b) => (a[0] < b[0] ? -1 : 1))
              .map(([d, list]) => (
                <div key={d}>
                  <p className={`eyebrow mb-2 ${d === today ? "text-brand" : "text-ink/40"}`}>
                    {d === today ? "Today · " : ""}
                    {dayLabel(d)}
                  </p>
                  <div className="space-y-1.5">
                    {list.map((e, i) => (
                      <EventRow key={i} e={e} tone={tone(e.person)} onClick={() => setSelected(e)} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      <Card tint="sage">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Calendar links</h3>
            <p className="mt-0.5 text-xs text-ink/50">
              {saved ? `Your Google Calendar is connected${others.length ? ` · ${others.join(", ")} too` : ""}.` : others.length ? `${others.join(", ")} connected. Add yours to see both.` : "Paste your secret Google Calendar link."}
            </p>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {saved ? "Change" : "Connect"}
          </button>
        </div>
        {open && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-ink/50">In Google Calendar → Settings → your calendar → Integrate calendar, copy “Secret address in iCal format”.</p>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className="w-full rounded-xl border border-ink/15 bg-mist px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => void saveLink()} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save link
              </button>
              <button onClick={() => setOpen(false)} className="rounded-full bg-mist px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              {saved && (
                <button onClick={() => void removeLink()} className="ml-auto px-2 py-2 text-sm font-semibold text-rose">
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
        {status && <p className="mt-2 text-xs text-ink/50">{status}</p>}
        <p className="mt-2 text-[11px] text-ink/40">Events are managed in Google Calendar — changes show here after a refresh.</p>
      </Card>

      {dayOpen && !selected && (
        <Sheet onClose={() => setDayOpen(null)}>
          <h2 className="mb-3 font-display text-2xl">{dayLabel(dayOpen)}</h2>
          {(byDay.get(dayOpen) ?? []).length === 0 && <p className="text-sm text-ink/45">Nothing planned.</p>}
          <div className="space-y-1.5">
            {(byDay.get(dayOpen) ?? []).map((e, i) => (
              <EventRow key={i} e={e} tone={tone(e.person)} onClick={() => setSelected(e)} />
            ))}
          </div>
        </Sheet>
      )}

      {selected && (
        <Sheet onClose={() => setSelected(null)}>
          <div className="mb-2 flex items-center gap-2">
            <span className={`size-3 rounded-full ${TONE_DOT[tone(selected.person)]}`} />
            <span className="text-xs font-semibold text-ink/55">{selected.person}'s calendar</span>
          </div>
          <h2 className="font-display text-2xl">{selected.title}</h2>
          <p className="mt-2 text-sm text-ink/65">{dayLabel(selected.date)}</p>
          <p className="text-sm text-ink/65">{timeLabel(selected)}</p>
          <p className="mt-4 text-xs text-ink/40">Read-only · edit this event in Google Calendar.</p>
        </Sheet>
      )}
    </>
  );
}

function EventRow({ e, tone, onClick }: { e: FeedEvent; tone: "brand" | "accent" | "herb"; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl bg-mist/60 px-3 py-2 text-left">
      <span className={`size-2.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      <span className="w-24 shrink-0 text-xs font-semibold text-ink/50">{timeLabel(e)}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
      <span className="shrink-0 text-xs text-ink/40">{e.person}</span>
    </button>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 backdrop-blur-sm" onClick={onClose}>
      <div className="glass max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
        {children}
        <button onClick={onClose} className="mt-5 w-full rounded-2xl bg-card/80 py-3 text-sm font-semibold text-ink/60">
          Close
        </button>
      </div>
    </div>
  );
}
