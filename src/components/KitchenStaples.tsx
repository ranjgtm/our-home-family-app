import { useState } from "react";
import { STAPLE_GROUPS, useHome, type PantryStatus } from "@/lib/home-store";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Quick-select sheet: tap to mark a staple Available, tap again to unmark. */
export function StaplesPicker({ onClose }: { onClose: () => void }) {
  const { pantry, toggleStaple } = useHome();
  const [custom, setCustom] = useState("");
  const on = (name: string) => pantry.some((p) => norm(p.name) === norm(name) && p.status === "Available");
  const known = new Set(STAPLE_GROUPS.flatMap((g) => g.items.map(norm)));
  const extras = pantry.filter((p) => p.staple && !known.has(norm(p.name)));

  const Chip = ({ name, category }: { name: string; category: Parameters<typeof toggleStaple>[1] }) => {
    const active = on(name);
    return (
      <button
        onClick={() => void toggleStaple(name, category)}
        className={`rounded-full px-3 py-2 text-sm font-medium transition ${active ? "bg-herb text-primary-foreground" : "bg-mist text-ink/70"}`}
      >
        {active ? "✓ " : ""}
        {name}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30" onClick={onClose}>
      <div
        className="mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-xl">What's in your kitchen?</p>
        <p className="mb-4 text-sm text-ink/60">Tap what you have. No quantities needed.</p>
        {STAPLE_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            <p className="eyebrow mb-2 text-herb">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((n) => (
                <Chip key={n} name={n} category={g.category} />
              ))}
            </div>
          </div>
        ))}
        <p className="eyebrow mb-2 text-herb">Your own</p>
        {extras.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {extras.map((p) => (
              <Chip key={p.id} name={p.name} category={p.category} />
            ))}
          </div>
        )}
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = custom.trim();
            if (!n) return;
            if (!on(n)) void toggleStaple(n, "Pantry");
            setCustom("");
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Jimbu, paneer, potatoes"
            maxLength={80}
            className="min-w-0 flex-1 rounded-2xl bg-mist px-4 py-3 text-base outline-none"
          />
          <button className="rounded-2xl bg-brand px-4 text-sm font-semibold text-primary-foreground">Add</button>
        </form>
        <button onClick={onClose} className="w-full rounded-2xl bg-brand py-3.5 text-sm font-semibold text-primary-foreground">
          Done
        </button>
      </div>
    </div>
  );
}

/** Kitchen Staples section shown inside At Home. */
export function KitchenStaples() {
  const { pantry, setPantryStatus, pantryToShopping, shopping, me } = useHome();
  const [open, setOpen] = useState(false);
  const staples = pantry.filter((p) => p.staple).sort((a, b) => a.name.localeCompare(b.name));
  const onList = new Set(shopping.map((s) => norm(s.name)));

  return (
    <div className="mb-4 rounded-3xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Kitchen Staples</h3>
        <span className="text-xs text-ink/45">{staples.filter((s) => s.status === "Available").length} available</span>
      </div>
      <button onClick={() => setOpen(true)} className="mb-3 w-full rounded-2xl bg-herb py-3 text-sm font-semibold text-primary-foreground">
        + Add kitchen staples
      </button>
      {staples.length === 0 ? (
        <p className="text-center text-xs text-ink/45">Spices, rice, dal, oils… tap to add them in seconds 🌿</p>
      ) : (
        <div className="space-y-2">
          {staples.map((p) => (
            <div key={p.id} className="rounded-2xl bg-mist/60 p-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                {(["Available", "Low", "Used Up"] as PantryStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPantryStatus(p.id, s)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${p.status === s ? "bg-brand text-primary-foreground" : "bg-card/70 text-ink/50"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {p.status !== "Available" && (
                <button
                  disabled={onList.has(norm(p.name))}
                  onClick={() => pantryToShopping(p.id, me)}
                  className="mt-2 w-full rounded-xl bg-rose/15 py-2 text-xs font-semibold text-rose disabled:bg-herb/15 disabled:text-herb"
                >
                  {onList.has(norm(p.name)) ? "On the shopping list ✓" : "Add to Shopping List"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {open && <StaplesPicker onClose={() => setOpen(false)} />}
    </div>
  );
}
