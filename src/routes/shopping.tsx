import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/AppShell";
import { Deals, OfferCard, matchKind, useOffers } from "@/components/Deals";
import { PurchaseSheet } from "@/components/PurchaseSheet";
import { KitchenStaples } from "@/components/KitchenStaples";
import { CATEGORIES, FOOD_CATEGORIES, euro, initials, parseEuro, useHome, type Category, type PantryStatus, type Person } from "@/lib/home-store";

export const Route = createFileRoute("/shopping")({
  head: () => ({
    meta: [
      { title: "Shopping · Our Home" },
      { name: "description", content: "Shared to-buy list and home pantry for your family." },
      { property: "og:title", content: "Shopping · Our Home" },
      { property: "og:description", content: "Shared to-buy list and home pantry, always in sync." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Shopping,
});

const STATUS_STYLES: Record<PantryStatus, string> = {
  Available: "bg-herb/15 text-herb",
  Low: "bg-accent/20 text-accent",
  "Used Up": "bg-rose/15 text-rose",
};

function Shopping() {
  const {
    shopping,
    pantry,
    bought,
    addShoppingItem,
    toggleShoppingItem,
    moveToPantry,
    removeShoppingItem,
    setPantryStatus,
    pantryToShopping,
    deletePurchased,
    updatePurchased,
    renamePantryItem,

    frequent,
    toggleFrequent,
    addUsualItems,
    findDuplicate,
    deletePantryItem,
    me,
    toneOf,
  } = useHome();
  const [saved, setSaved] = useState<string | null>(null);
  const [showAllBought, setShowAllBought] = useState(false);
  const [editBought, setEditBought] = useState<string | null>(null);

  const who: Person = me;
  const [tab, setTab] = useState<"buy" | "home" | "deals">("buy");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [usualMsg, setUsualMsg] = useState<string | null>(null);

  const checked = shopping.filter((i) => i.done);
  const open = shopping.filter((i) => !i.done);
  const isFrequent = (n: string) => frequent.some((f) => f.toLowerCase() === n.toLowerCase());
  const { current } = useOffers();
  const [offerFor, setOfferFor] = useState<string | null>(null);

  const [dupe, setDupe] = useState<string | null>(null);
  const submit = (force = false) => {
    if (!name.trim()) return;
    const existing = findDuplicate(name);
    if (existing && !force) {
      setDupe(existing.name);
      return;
    }
    setDupe(null);
    void addShoppingItem(
      {
        name: name.trim(),
        quantity: quantity.trim() || undefined,
        category,
        note: note.trim() || undefined,
        addedBy: who,
      },
      force,
    );
    setName("");
    setQuantity("");
    setNote("");
    setCategory("Other");
    setExpanded(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Together"
        title="Shopping"
        right={
          <div className="glass flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-semibold">
            <span
              className={`grid size-7 place-items-center rounded-full ${
                toneOf(who) === "accent" ? "bg-accent text-accent-foreground" : "bg-brand text-primary-foreground"
              }`}
            >
              {initials(who)}
            </span>
            <span className="text-ink/60">You</span>
          </div>
        }
      />


      <div className="glass mb-4 flex rounded-2xl p-1">
        <button
          onClick={() => setTab("buy")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
            tab === "buy" ? "bg-brand text-primary-foreground" : "text-ink/60"
          }`}
        >
          To Buy · {open.length}
        </button>
        <button
          onClick={() => setTab("home")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
            tab === "home" ? "bg-brand text-primary-foreground" : "text-ink/60"
          }`}
        >
          At Home · {pantry.length}
        </button>
        <button
          onClick={() => setTab("deals")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
            tab === "deals" ? "bg-brand text-primary-foreground" : "text-ink/60"
          }`}
        >
          Deals
        </button>
      </div>

      {tab === "buy" ? (
        <>
          <Card className="mb-4" tint="sage">
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setExpanded(true)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Add an item…"
                className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-ink/40"
              />
              <button
                onClick={() => submit()}
                className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-2xl leading-none text-primary-foreground"
              >
                +
              </button>
            </div>

            {dupe && (
              <div className="mt-3 rounded-2xl bg-accent/15 p-3 text-sm">
                <p className="font-semibold text-ink">{dupe} is already on your shopping list.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setDupe(null);
                      setName("");
                      setQuantity("");
                      setNote("");
                    }}
                    className="flex-1 rounded-full bg-brand py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Use existing
                  </button>
                  <button onClick={() => submit(true)} className="flex-1 rounded-full bg-card py-2 text-xs font-semibold text-ink/70">
                    Add another
                  </button>
                </div>
              </div>
            )}

            {expanded && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Quantity (optional)"
                    className="w-1/2 rounded-xl bg-mist px-3 py-3 text-sm outline-none placeholder:text-ink/40"
                  />
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-1/2 rounded-xl bg-mist px-3 py-3 text-sm outline-none placeholder:text-ink/40"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        category === c ? "bg-brand text-primary-foreground" : "bg-mist text-ink/60"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {frequent.length > 0 && (
            <Card className="mb-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="eyebrow text-ink/40">Frequently bought</p>
                <button
                  onClick={async () => {
                    const n = await addUsualItems();
                    setUsualMsg(n ? `Added ${n} usual item${n === 1 ? "" : "s"}` : "All usual items are already on the list");
                    setTimeout(() => setUsualMsg(null), 2500);
                  }}
                  className="shrink-0 rounded-full bg-herb/15 px-3 py-1.5 text-xs font-semibold text-herb"
                >
                  + Add usual items
                </button>
              </div>
              {usualMsg && <p className="mb-2 text-xs text-herb">{usualMsg}</p>}
              <div className="flex flex-wrap gap-2">
                {frequent.map((f) => {
                  const onList = shopping.some((i) => i.name.toLowerCase() === f.toLowerCase());
                  return (
                    <button
                      key={f}
                      disabled={onList}
                      onClick={() => void addShoppingItem({ name: f, addedBy: who })}
                      className={`rounded-full px-3 py-2 text-xs font-medium ${
                        onList ? "bg-herb/15 text-herb" : "bg-mist text-ink/70"
                      }`}
                    >
                      {onList ? `${f} ✓` : `+ ${f}`}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="mb-4">
            <h3 className="mb-3 text-sm font-semibold">To Buy</h3>
            <div className="space-y-1">
              {open.length === 0 && (
                <p className="py-4 text-center text-sm text-ink/40">Everything is bought 🎉</p>
              )}
              {open.map((i) => (
                <div key={i.id} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleShoppingItem(i.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-1 py-2.5 text-left"
                  >
                    <span className="mt-0.5 size-5 shrink-0 rounded-md border-2 border-rose/40" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {i.name}
                        {i.quantity ? ` · ${i.quantity}` : ""}
                        {i.unit ? ` ${i.unit}` : ""}
                      </span>
                      <span className="block truncate text-xs text-ink/45">
                        {i.category}
                        {i.note ? ` · ${i.note}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink/40">{i.addedBy}</span>
                  </button>
                  {current.some((o) => matchKind(i.name, o)) && (
                    <button
                      onClick={() => setOfferFor(i.name)}
                      className="mt-2 shrink-0 rounded-full bg-herb/15 px-2 py-1 text-[11px] font-semibold text-herb"
                    >
                      🌿 Lidl offer
                    </button>
                  )}
                  <button
                    onClick={() => toggleFrequent(i.name)}
                    aria-label="Mark as frequently bought"
                    className={`shrink-0 py-2.5 text-base ${isFrequent(i.name) ? "text-accent" : "text-ink/25"}`}
                  >
                    {isFrequent(i.name) ? "★" : "☆"}
                  </button>
                  <button
                    onClick={() => removeShoppingItem(i.id)}
                    aria-label={`Delete ${i.name}`}
                    className="shrink-0 px-1 py-2.5 text-base text-ink/30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {checked.length > 0 && (
              <div className="mt-4 border-t border-ink/5 pt-4">
                <p className="eyebrow mb-3 text-ink/40">In the basket</p>
                <div className="space-y-2">
                  {checked.map((i) => (
                    <div key={i.id} className="flex items-center gap-3">
                      <button
                        onClick={() => toggleShoppingItem(i.id)}
                        className="grid size-5 shrink-0 place-items-center rounded-md bg-herb text-[11px] text-primary-foreground"
                      >
                        ✓
                      </button>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink/45 line-through">
                        {i.name}
                      </span>
                      {FOOD_CATEGORIES.includes(i.category) ? (
                        <button
                          onClick={() => moveToPantry(i.id)}
                          className="shrink-0 rounded-full bg-herb/15 px-3 py-1.5 text-xs font-semibold text-herb"
                        >
                          → At Home
                        </button>
                      ) : (
                        <button
                          onClick={() => removeShoppingItem(i.id)}
                          className="shrink-0 rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-ink/50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="mb-4">
            <h3 className="mb-3 text-sm font-semibold">Bought Recently</h3>
            <div className="space-y-2.5">
              {bought.length === 0 && (
                <p className="py-2 text-center text-sm text-ink/40">Nothing bought yet 🌱</p>
              )}
              {(showAllBought ? bought : bought.slice(0, 8)).map((b) =>
                editBought === b.id ? (
                  <BoughtEditor
                    key={b.id}
                    name={b.name}
                    price={b.price}
                    onCancel={() => setEditBought(null)}
                    onSave={async (n, p) => {
                      await updatePurchased(b.id, n, p);
                      setEditBought(null);
                    }}
                    onDelete={async () => {
                      await deletePurchased(b.id);
                      setEditBought(null);
                    }}
                  />
                ) : (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className="grid size-5 shrink-0 place-items-center rounded-md bg-herb/15 text-[11px] text-herb">✓</span>
                    <button onClick={() => setEditBought(b.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm text-ink/70">
                        {b.name}
                        {b.price != null && <span className="text-ink/45"> · {euro(b.price)}</span>}
                      </span>
                      <span className="block truncate text-[11px] text-ink/40">
                        {b.when}
                        {b.store ? ` · ${b.store}` : ""} · {b.by}
                      </span>
                    </button>
                    <button
                      onClick={() => toggleFrequent(b.name)}
                      aria-label="Mark as frequently bought"
                      className={`shrink-0 text-base ${isFrequent(b.name) ? "text-accent" : "text-ink/25"}`}
                    >
                      {isFrequent(b.name) ? "★" : "☆"}
                    </button>
                  </div>
                ),
              )}
              {bought.length > 8 && (
                <button onClick={() => setShowAllBought((v) => !v)} className="w-full pt-1 text-xs font-semibold text-brand">
                  {showAllBought ? "Show fewer" : `Show all ${bought.length}`}
                </button>
              )}
              {bought.length > 0 && <p className="pt-1 text-[11px] text-ink/40">Tap an item to fix or delete it.</p>}
            </div>
          </Card>

          {saved && <p role="status" className="mb-3 rounded-2xl bg-herb/15 p-3 text-sm font-semibold text-herb">✓ {saved}</p>}
          <button
            onClick={() => setSheet(true)}
            className="w-full rounded-3xl bg-brand py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-brand/25"
          >
            Finish Shopping
          </button>
        </>
      ) : tab === "deals" ? (
        <Deals listNames={open.map((i) => i.name)} />
      ) : (
        <>
          <KitchenStaples />
          <PantryList
            setPantryStatus={setPantryStatus}
            deletePantryItem={deletePantryItem}
            pantryToShopping={(id) => pantryToShopping(id, who)}
            renamePantryItem={renamePantryItem}
            pantry={pantry.filter((p) => !p.staple)}
          />
        </>
      )}

      {offerFor && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/30" onClick={() => setOfferFor(null)}>
          <div className="mx-auto w-full max-w-md space-y-3 rounded-t-3xl bg-background p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg">Lidl offers for “{offerFor}”</p>
            {current
              .map((o) => ({ o, kind: matchKind(offerFor, o) }))
              .filter((x) => x.kind)
              .map(({ o, kind }) => (
                <OfferCard key={o.id} offer={o} match={{ item: offerFor, kind: kind! }} />
              ))}
            <button onClick={() => setOfferFor(null)} className="w-full rounded-2xl bg-mist py-3 text-sm font-semibold">
              Close
            </button>
          </div>
        </div>
      )}

      {sheet && (
        <PurchaseSheet
          mode="trip"
          onClose={() => setSheet(false)}
          onSaved={(m) => {
            setSheet(false);
            setSaved(m);
            setTimeout(() => setSaved(null), 5000);
          }}
        />
      )}
    </>
  );
}

function PantryList({
  pantry,
  setPantryStatus,
  deletePantryItem,
  pantryToShopping,
  renamePantryItem,
}: {
  renamePantryItem: (id: string, name: string) => Promise<void>;
  pantry: ReturnType<typeof useHome>["pantry"];
  deletePantryItem: (id: string) => void;
  setPantryStatus: (id: string, s: PantryStatus) => void;
  pantryToShopping: (id: string) => void;
}) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold">At Home</h3>
      <div className="space-y-3">
        {pantry.length === 0 && (
          <p className="py-4 text-center text-sm text-ink/40">Nothing here yet — bought food lands here 🌿</p>
        )}
        {pantry.map((p) => (
          <div key={p.id} className="rounded-2xl bg-mist/60 p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <button
                  onClick={() => {
                    const n = window.prompt("Rename item", p.name);
                    if (n && n.trim() && n.trim() !== p.name) void renamePantryItem(p.id, n);
                  }}
                  className="block max-w-full truncate text-left text-sm font-medium"
                >
                  {p.name}
                </button>
                <p className="text-xs text-ink/45">{p.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[p.status]}`}>
                {p.status}
              </span>
              <button onClick={() => deletePantryItem(p.id)} aria-label={`Delete ${p.name}`} className="px-1 text-base text-ink/30">
                ✕
              </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {(["Available", "Low", "Used Up"] as PantryStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setPantryStatus(p.id, s)}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold ${
                    p.status === s ? "bg-brand text-primary-foreground" : "bg-card/70 text-ink/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {p.status === "Used Up" && (
              <button
                onClick={() => pantryToShopping(p.id)}
                className="mt-2 w-full rounded-xl bg-rose/15 py-2.5 text-xs font-semibold text-rose"
              >
                Add to shopping list
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function BoughtEditor({
  name,
  price,
  onSave,
  onDelete,
  onCancel,
}: {
  name: string;
  price: number | null;
  onSave: (name: string, price: number | null) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(price == null ? "" : price.toFixed(2).replace(".", ","));
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = (f: () => Promise<void>) => f().catch((e: Error) => setErr(e.message));
  return (
    <div className="rounded-2xl bg-mist/70 p-3">
      <div className="flex gap-2">
        <input value={n} onChange={(e) => setN(e.target.value)} aria-label="Item name" className="min-w-0 flex-1 rounded-xl bg-card px-3 py-2.5 text-sm outline-none" />
        <input
          value={p}
          onChange={(e) => setP(e.target.value)}
          inputMode="decimal"
          placeholder="€"
          aria-label="Price"
          className="w-20 shrink-0 rounded-xl bg-card px-3 py-2.5 text-right text-sm outline-none"
        />
      </div>
      {err && <p className="mt-2 text-xs text-rose">{err}</p>}
      {confirm ? (
        <div className="mt-2 flex gap-2">
          <button onClick={() => setConfirm(false)} className="flex-1 rounded-full bg-card py-2 text-xs font-semibold text-ink/60">
            Keep
          </button>
          <button onClick={() => run(onDelete)} className="flex-1 rounded-full bg-rose py-2 text-xs font-semibold text-primary-foreground">
            Delete item
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => setConfirm(true)} className="text-xs font-semibold text-rose">
            Delete
          </button>
          <span className="flex-1" />
          <button onClick={onCancel} className="rounded-full bg-card px-3 py-2 text-xs font-semibold text-ink/60">
            Cancel
          </button>
          <button
            onClick={() => {
              const v = parseEuro(p);
              void run(() => onSave(n, Number.isFinite(v) ? v : null));
            }}
            className="rounded-full bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
