import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, PageHeader } from "@/components/AppShell";
import { CUISINES, isoDate, useHome, type CuisineFreq, type NewPlannedMeal, type PlannedMeal } from "@/lib/home-store";
import { StaplesPicker } from "@/components/KitchenStaples";
import { suggestMeals, type SuggestedMeal } from "@/lib/meals.functions";

export const Route = createFileRoute("/meals")({
  head: () => ({
    meta: [
      { title: "Meals · Our Home" },
      { name: "description", content: "A weekly meal plan for a family of 3, built from what's already at home." },
      { property: "og:title", content: "Meals · Our Home" },
      { property: "og:description", content: "A weekly meal plan for a family of 3, built from what's already at home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Meals,
});

type Suggestion = SuggestedMeal & { key: string; busy?: boolean };

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const today = isoDate(new Date());
  if (iso === today) return "Today";
  if (iso === isoDate(new Date(Date.now() + 86400000))) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center justify-between py-2 text-left text-sm">
      <span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${on ? "bg-herb" : "bg-ink/15"}`}>
        <span className={`h-5 w-5 rounded-full bg-surface transition ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "have" | "miss" }) {
  if (items.length === 0) return <span className="text-xs text-ink/40">Nothing</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <span
          key={i}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone === "have" ? "bg-herb/15 text-herb" : "bg-rose/15 text-rose"}`}
        >
          {i} {tone === "have" ? "✓" : "✕"}
        </span>
      ))}
    </div>
  );
}

function MealBody({ m }: { m: { name: string; cuisine: string | null; prepMinutes: number | null; atHome: string[]; staplesUsed: string[]; missing: string[]; toddlerNote: string | null } }) {
  return (
    <>
      <h2 className="font-display text-2xl leading-tight">{m.name}</h2>
      <p className="mb-2 text-sm text-ink/60">
        {m.cuisine ? `${m.cuisine} · ` : ""}
        {m.prepMinutes ? `About ${m.prepMinutes} min · ` : ""}one meal for everyone
      </p>
      {m.toddlerNote && (
        <p className="mb-3 text-xs text-herb">
          🌿 <span className="italic text-ink/60">{m.toddlerNote}</span>
        </p>
      )}
      <p className="eyebrow mb-2 text-ink/40">At home</p>
      <div className="mb-3">
        <Chips items={m.atHome} tone="have" />
      </div>
      {m.staplesUsed.length > 0 && (
        <>
          <p className="eyebrow mb-2 text-ink/40">Kitchen staples used</p>
          <p className="mb-3 text-xs text-ink/60">{m.staplesUsed.join(" · ")}</p>
        </>
      )}
      {m.missing.length > 0 && (
        <>
          <p className="eyebrow mb-2 text-ink/40">Missing</p>
          <div className="mb-4">
            <Chips items={m.missing} tone="miss" />
          </div>
        </>
      )}
    </>
  );
}

function Meals() {
  const { pantry, shopping, planned, keepMeal, removePlanned, addMissingToShopping, me, cuisinePrefs, setCuisinePref } = useHome();
  const [kitchen, setKitchen] = useState(false);
  const suggest = useServerFn(suggestMeals);

  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<3 | 5 | 7>(5);
  const [lunch, setLunch] = useState(false);
  const [toddler, setToddler] = useState(true);
  const [pantryFirst, setPantryFirst] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Suggestion[]>([]);
  const [added, setAdded] = useState<string[]>([]);

  const onList = new Set(shopping.map((s) => s.name.toLowerCase()));
  // One entry per ingredient, whichever way it arrived (receipt, list, manual, staple).
  const seen = new Set<string>();
  const usable = pantry.filter((p) => {
    const k = p.name.toLowerCase().replace(/\s+/g, " ").trim();
    if (p.status === "Used Up" || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const pantryInput = usable.filter((p) => !p.staple).map((p) => ({ name: p.name, status: p.status }));
  const staplesInput = usable.filter((p) => p.staple).map((p) => p.name);

  const run = async (slots: { date: string; slot: "lunch" | "dinner" }[], avoid: string[]) => {
    const res = await suggest({ data: { slots, pantry: pantryInput, staples: staplesInput, cuisines: cuisinePrefs, toddler, pantryFirst, avoid } });
    if (res.error) setError(res.error);
    return res.meals;
  };

  const plan = async () => {
    setLoading(true);
    setError(null);
    setOpen(false);
    const slots: { date: string; slot: "lunch" | "dinner" }[] = [];
    for (let i = 0; i < days; i++) {
      const date = isoDate(new Date(Date.now() + i * 86400000));
      if (lunch) slots.push({ date, slot: "lunch" });
      slots.push({ date, slot: "dinner" });
    }
    try {
      const meals = await run(slots, []);
      setIdeas(meals.map((m, i) => ({ ...m, key: `${m.date}-${m.slot}-${i}-${Date.now()}` })));
    } catch {
      setError("Couldn't get meal ideas right now.");
    }
    setLoading(false);
  };

  const replace = async (s: Suggestion) => {
    setIdeas((l) => l.map((x) => (x.key === s.key ? { ...x, busy: true } : x)));
    try {
      const [m] = await run([{ date: s.date, slot: s.slot }], [s.name, ...ideas.map((i) => i.name), ...planned.map((p) => p.name)]);
      setIdeas((l) => l.map((x) => (x.key === s.key ? (m ? { ...m, key: `${s.key}-r` } : { ...x, busy: false }) : x)));
    } catch {
      setIdeas((l) => l.map((x) => (x.key === s.key ? { ...x, busy: false } : x)));
    }
  };

  const keep = async (s: Suggestion) => {
    const m: NewPlannedMeal = {
      date: s.date,
      slot: s.slot,
      name: s.name,
      prepMinutes: s.prepMinutes,
      atHome: s.atHome,
      missing: s.missing,
      toddlerNote: s.toddlerNote,
      toddlerFriendly: toddler,
      cuisine: s.cuisine,
      staplesUsed: s.staplesUsed,
    };
    try {
      await keepMeal(m);
      setIdeas((l) => l.filter((x) => x.key !== s.key));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this meal");
    }
  };

  const addMissing = (key: string, missing: string[]) => {
    const fresh = missing.filter((n) => !onList.has(n.toLowerCase()));
    if (fresh.length) addMissingToShopping(fresh, me);
    setAdded((a) => [...a, key]);
  };

  const MissingButton = ({ id, missing }: { id: string; missing: string[] }) => {
    const fresh = missing.filter((n) => !onList.has(n.toLowerCase()));
    const done = added.includes(id) || fresh.length === 0;
    return (
      <button
        disabled={done}
        onClick={() => addMissing(id, missing)}
        className={`w-full rounded-2xl py-3.5 text-sm font-semibold ${done ? "bg-herb/15 text-herb" : "bg-brand text-primary-foreground"}`}
      >
        {missing.length === 0
          ? "Everything is already at home"
          : done
            ? "On the shopping list ✓"
            : `Add ${fresh.length} missing to Shopping`}
      </button>
    );
  };

  const sortedPlan = [...planned].sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));

  return (
    <>
      <PageHeader eyebrow="2 adults + toddler · pantry first" title="Meals" />

      <Card className="mb-4" tint="sage">
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            disabled={loading}
            className="w-full rounded-2xl bg-brand py-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Finding meals from what's at home…" : ideas.length || planned.length ? "Plan again" : "Plan meals"}
          </button>
        ) : (
          <div>
            <p className="eyebrow mb-2 text-herb">Plan meals</p>
            <p className="mb-2 text-sm text-ink/60">Days</p>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {([3, 5, 7] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setDays(n)}
                  className={`rounded-2xl py-2.5 text-sm font-semibold ${days === n ? "bg-brand text-primary-foreground" : "bg-mist text-ink/70"}`}
                >
                  {n} days
                </button>
              ))}
            </div>
            <p className="mb-2 text-sm text-ink/60">Meals</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[
                { v: false, l: "Dinner only" },
                { v: true, l: "Lunch + Dinner" },
              ].map((o) => (
                <button
                  key={o.l}
                  onClick={() => setLunch(o.v)}
                  className={`rounded-2xl py-2.5 text-sm font-semibold ${lunch === o.v ? "bg-brand text-primary-foreground" : "bg-mist text-ink/70"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <Toggle on={toddler} onChange={setToddler} label="Toddler-friendly meals" />
            <Toggle on={pantryFirst} onChange={setPantryFirst} label="Prefer ingredients already at home" />
            <p className="mt-3 mb-2 text-sm text-ink/60">Cuisines</p>
            <div className="mb-3 space-y-2">
              {CUISINES.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-xs">{c}</span>
                  {(["Often", "Sometimes", "Rarely"] as CuisineFreq[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => void setCuisinePref(c, f).catch((e: Error) => setError(e.message))}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${cuisinePrefs[c] === f ? "bg-brand text-primary-foreground" : "bg-mist text-ink/60"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 mb-3 text-xs text-ink/50">
              Using {pantryInput.length} food item{pantryInput.length === 1 ? "" : "s"} and {staplesInput.length} kitchen staple{staplesInput.length === 1 ? "" : "s"} from At Home.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-2xl bg-mist py-3.5 text-sm font-semibold text-ink/70">
                Cancel
              </button>
              <button onClick={() => void plan()} className="flex-[2] rounded-2xl bg-brand py-3.5 text-sm font-semibold text-primary-foreground">
                Suggest meals
              </button>
            </div>
          </div>
        )}
        <button onClick={() => setKitchen(true)} className="mt-3 w-full text-center text-xs font-semibold text-herb underline-offset-2 hover:underline">
          What else is in your kitchen?
        </button>
        {error && <p className="mt-3 text-sm text-rose">{error}</p>}
      </Card>

      {ideas.length > 0 && (
        <>
          <p className="eyebrow mb-2 px-1 text-ink/50">Suggestions · keep the ones you like</p>
          <div className="mb-6 space-y-4">
            {ideas.map((s) => (
              <Card key={s.key} tint="peach" className={s.busy ? "opacity-60" : ""}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow text-brand">{dayLabel(s.date)}</span>
                  <span className="text-xs font-medium capitalize text-ink/50">{s.slot}</span>
                </div>
                <MealBody m={s} />
                <div className="mb-2 grid grid-cols-3 gap-2">
                  <button onClick={() => void keep(s)} disabled={s.busy} className="rounded-2xl bg-herb py-3 text-sm font-semibold text-primary-foreground">
                    Keep
                  </button>
                  <button onClick={() => void replace(s)} disabled={s.busy} className="rounded-2xl bg-mist py-3 text-sm font-semibold text-ink/70">
                    {s.busy ? "…" : "Replace"}
                  </button>
                  <button onClick={() => setIdeas((l) => l.filter((x) => x.key !== s.key))} className="rounded-2xl bg-mist py-3 text-sm font-semibold text-ink/50">
                    Skip
                  </button>
                </div>
                <MissingButton id={s.key} missing={s.missing} />
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="eyebrow mb-2 px-1 text-ink/50">Our plan</p>
      {sortedPlan.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/60">No meals planned yet. Tap Plan meals to get ideas from what's at home. 🌿</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedPlan.map((m: PlannedMeal) => (
            <Card key={m.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="eyebrow text-brand">{dayLabel(m.date)}</span>
                <button onClick={() => void removePlanned(m.id)} className="text-xs font-medium text-ink/40">
                  <span className="capitalize">{m.slot}</span> · Remove
                </button>
              </div>
              <MealBody m={m} />
              <MissingButton id={m.id} missing={m.missing} />
            </Card>
          ))}
        </div>
      )}
      {kitchen && <StaplesPicker onClose={() => setKitchen(false)} />}
    </>
  );
}
