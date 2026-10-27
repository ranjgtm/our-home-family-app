import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { syncCalendarFeeds, type FeedEvent } from "@/lib/calendar.functions";
import { Avatars, Card, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { DAYS, currentWeek, euro, isoDate, useHome } from "@/lib/home-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today · Our Home" },
      { name: "description", content: "Today's plans, spending, dinner and shopping for your family." },
      { property: "og:title", content: "Today · Our Home" },
      { property: "og:description", content: "Today's plans, spending, dinner and shopping list at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Index() {
  const { shopping, planned, expenses, addShoppingItem, findDuplicate, me, household, toneOf, renameMe } = useHome();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");

  const runSync = useServerFn(syncCalendarFeeds);
  const [calEvents, setCalEvents] = useState<FeedEvent[] | null>(null);
  const [calError, setCalError] = useState(false);
  const [adding2, setAdding2] = useState(false);
  useEffect(() => {
    let alive = true;
    runSync({ data: { weekStart: currentWeek()[0]!, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } })
      .then((r) => alive && setCalEvents(r.events))
      .catch(() => alive && (setCalError(true), setCalEvents([])));
    return () => {
      alive = false;
    };
  }, [runSync]);
  const now = new Date();
  const remaining = shopping.filter((i) => !i.done).length;
  const todayEvents = (calEvents ?? [])
    .filter((e) => e.date === isoDate(now))
    .map((e, i) => ({ ...e, id: `t${i}`, withToddler: false }))
    .sort((a, b) => a.start - b.start);
  const timed = todayEvents.filter((e) => !e.allDay);
  const freeAfter = timed.length
    ? Math.max(...timed.map((e) => e.end))
    : null;
  const availability = freeAfter === null
    ? "Both free today"
    : freeAfter >= 24
      ? "Busy through tonight"
      : `Both free after ${String(Math.floor(freeAfter)).padStart(2, "0")}:${String(Math.round((freeAfter % 1) * 60)).padStart(2, "0")}`;
  const todayIso = isoDate(new Date());
  const meal = planned.find((m) => m.date === todayIso && m.slot === "dinner") ?? planned.find((m) => m.date === todayIso);

  const week = currentWeek();
  const weekSpend = expenses
    .filter((e) => e.date >= week[0]! && e.date <= week[6]!)
    .reduce((s, e) => s + e.amount, 0);

  const perDay = DAYS.map((d, idx) => {
    const date = week[idx]!;
    return {
      day: d[0],
      total: expenses.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0),
    };
  });
  const max = Math.max(...perDay.map((d) => d.total), 1);

  const [dupe, setDupe] = useState<string | null>(null);
  const addItem = (force: boolean) => {
    const name = itemName.trim();
    if (!name || adding2) return;
    const existing = findDuplicate(name);
    if (existing && !force) {
      setDupe(existing.name);
      return;
    }
    setDupe(null);
    setAdding2(true);
    setTimeout(() => setAdding2(false), 800);
    void addShoppingItem({ name, quantity: quantity.trim() || undefined, category: "Other", addedBy: me }, force);
    setItemName("");
    setQuantity("");
    setAdding(false);
  };
  const submitItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addItem(false);
  };

  return (
    <>
      <PageHeader eyebrow={`${WEEKDAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]} · family of 3`} title="Our Home" right={<Avatars />} />

      <Card className="mb-4" tint="peach">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow text-brand">Tonight's Meal</span>
          {meal?.prepMinutes ? <span className="text-xs font-medium text-ink/50">About {meal.prepMinutes} min</span> : null}
        </div>
        {meal ? (
          <>
            <h2 className="mb-1 font-display text-2xl">{meal.name}</h2>
            {meal.toddlerNote && <p className="mb-3 text-xs italic text-ink/60">🌿 {meal.toddlerNote}</p>}
            <div className="flex flex-wrap gap-2">
              {meal.atHome.map((ing) => (
                <span key={ing} className="rounded-full bg-herb/15 px-2.5 py-1 text-xs font-medium text-herb">{ing} ✓</span>
              ))}
              {meal.missing.map((ing) => (
                <span key={ing} className="rounded-full bg-rose/15 px-2.5 py-1 text-xs font-medium text-rose">{ing} ✕</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink/60">No meal planned tonight.</p>
            <Link to="/meals" className="block w-full rounded-2xl bg-brand py-3.5 text-center text-sm font-semibold text-primary-foreground">
              Plan tonight's meal
            </Link>
          </>
        )}
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Today's Schedule</h3>
          <span className="text-xs text-ink/40">{calEvents === null ? "Loading…" : `${todayEvents.length} events`}</span>
        </div>
        <div className="space-y-3">
          {calEvents !== null && todayEvents.length === 0 && (
            <p className="text-sm text-ink/50">
              {calError ? "Couldn't load your calendars right now. Try again later." : "No calendar events today."}
            </p>
          )}
          {todayEvents.map((e) => (
            <div key={e.id} className="flex items-center gap-3">
              <span
                className={`size-2.5 shrink-0 rounded-full ${
                  toneOf(e.person) === "accent" ? "bg-accent" : toneOf(e.person) === "herb" ? "bg-herb" : "bg-brand"
                }`}
              />
              <span
                className={`w-12 shrink-0 text-xs font-semibold ${
                  toneOf(e.person) === "accent" ? "text-accent" : toneOf(e.person) === "herb" ? "text-herb" : "text-brand"
                }`}
              >
                {e.allDay ? "All day" : `${String(Math.floor(e.start)).padStart(2, "0")}:${String(Math.round((e.start % 1) * 60)).padStart(2, "0")}`}
              </span>
              <span className="min-w-0 truncate text-sm">{e.title}</span>
              <span className="ml-auto shrink-0 text-xs text-ink/40">
                {e.person}{e.withToddler ? " · 🌼" : ""}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-ink/10 pt-3 text-sm font-semibold text-herb">
          {availability}
        </p>
      </Card>

      <Card className="mb-4" tint="lavender">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h3 className="min-w-0 font-display text-xl">Shopping Left</h3>
          <span className="shrink-0 rounded-full bg-rose/15 px-2.5 py-1 text-xs font-semibold text-rose">
            {remaining} items
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setAdding((open) => !open)}
          aria-expanded={adding}
          className="mb-3 h-auto min-h-10 w-full justify-start rounded-xl bg-brand/10 px-3 text-sm font-semibold text-brand hover:bg-brand/15 hover:text-brand"
        >
          + Add shopping item
        </Button>
        {adding && (
          <form onSubmit={submitItem} className="mb-4 space-y-2 rounded-xl bg-mist/70 p-3">
            <label className="block text-xs font-semibold text-ink/60" htmlFor="home-item-name">Item name</label>
            <input
              id="home-item-name"
              autoFocus
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="What do we need?"
              maxLength={80}
              required
              className="w-full rounded-lg bg-surface px-3 py-2.5 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <label className="block text-xs font-semibold text-ink/60" htmlFor="home-item-quantity">Quantity (optional)</label>
            <input
              id="home-item-quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 2 packs"
              maxLength={40}
              className="w-full rounded-lg bg-surface px-3 py-2.5 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)} className="text-ink/60">Cancel</Button>
              <Button type="submit" disabled={adding2} className="rounded-xl">Add item</Button>
            </div>
            {dupe && (
              <div className="rounded-xl bg-accent/15 p-3 text-sm">
                <p className="font-semibold">{dupe} is already on your shopping list.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => { setDupe(null); setItemName(""); setQuantity(""); setAdding(false); }} className="flex-1 rounded-full bg-brand py-2 text-xs font-semibold text-primary-foreground">
                    Use existing
                  </button>
                  <button type="button" onClick={() => addItem(true)} className="flex-1 rounded-full bg-card py-2 text-xs font-semibold text-ink/70">
                    Add another
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
        <div className="space-y-2">
          {remaining === 0 && <p className="py-2 text-sm text-ink/50">Nothing to buy yet 🌿</p>}
          {shopping
            .filter((i) => !i.done)
            .slice(0, 5)
            .map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                <span className="size-4 shrink-0 rounded-md border-2 border-rose/40" />
                <span className="min-w-0 truncate text-sm">
                  {i.name}
                  {i.quantity ? ` · ${i.quantity}` : ""}
                </span>
                <span className="ml-auto shrink-0 text-xs text-ink/40">{i.addedBy}</span>
              </div>
            ))}
        </div>
        <Link
          to="/shopping"
          className="mt-4 block rounded-2xl bg-brand py-3 text-center text-sm font-semibold text-primary-foreground"
        >
          Open shopping list
        </Link>
      </Card>

      <Card className="opacity-90" tint="sage">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink/70">Week Spending</h3>
          <span className="text-xs font-semibold text-ink/60">{euro(weekSpend)}</span>
        </div>
        <div className="flex h-16 items-end gap-2">
          {perDay.map((d, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className={`w-full rounded-t-md ${
                  d.total === max ? "bg-brand" : d.total > 0 ? "bg-brand/70" : "bg-brand/30"
                }`}
                style={{ height: `${Math.max((d.total / max) * 100, 6)}%` }}
              />
              <span className="text-[10px] text-ink/40">{d.day}</span>
            </div>
          ))}
        </div>
      </Card>

      {household && (
        <div className="mt-6 rounded-[1.75rem] border border-dashed border-herb/30 p-4 text-sm text-ink/60">
          <p className="eyebrow mb-2 text-herb">{household.name} · family of 3</p>
          <p>
            {household.members.join(" & ")} · 🌼 {household.childName}
          </p>
          {household.members.length < 2 && (
            <p className="mt-2">
              Invite your partner with code{" "}
              <span className="rounded-lg bg-brand/10 px-2 py-0.5 font-bold tracking-widest text-brand">
                {household.inviteCode}
              </span>
            </p>
          )}
          {renaming ? (
            <div className="mt-3 flex gap-2">
              <input
                value={newName}
                maxLength={40}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-mist px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <button
                onClick={async () => {
                  const err = await renameMe(newName);
                  if (!err) setRenaming(false);
                }}
                className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                Save
              </button>
              <button onClick={() => setRenaming(false)} className="shrink-0 text-xs text-ink/45">
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-3 flex gap-4">
              <button
                onClick={() => {
                  setNewName(me);
                  setRenaming(true);
                }}
                className="text-xs font-semibold text-brand underline"
              >
                Change my name
              </button>
              <Link to="/settings" className="text-xs font-semibold text-ink/55 underline">
                Account & settings
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
