import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { scanReceipt, type ScannedReceipt } from "@/lib/receipts.functions";
import {
  CATEGORIES,
  EXPENSE_CATEGORIES,
  FOOD_CATEGORIES,
  asExpenseCategory,
  euro,
  guessAtHome,
  isoDate,
  normName,
  parseEuro,
  useHome,
  type Category,
  type ExpenseCategory,
  type Person,
  type PurchaseLine,
} from "@/lib/home-store";

type Line = PurchaseLine & { priceText: string; expCat?: ExpenseCategory | undefined; onList: boolean };

const asCat = (c: string): Category => ((CATEGORIES as readonly string[]).includes(c) ? (c as Category) : "Other");
const key = () => Math.random().toString(36).slice(2, 10);
const fmt = (n: number | null) => (n == null ? "" : n.toFixed(2).replace(".", ","));

/**
 * One sheet for every purchase: a manual expense or finishing a shopping trip.
 * Optional receipt photo is read on the server; the user reviews every item before anything is saved.
 */
export function PurchaseSheet({
  mode,
  onClose,
  onSaved,
}: {
  mode: "expense" | "trip";
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const home = useHome();
  const { me, adults, toneOf, shopping, merchantCategory, basketCategories, matchShoppingItem, uploadReceipt, savePurchase } = home;
  const scan = useServerFn(scanReceipt);

  const [tripId] = useState(() => crypto.randomUUID());
  const [store, setStore] = useState("");
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [total, setTotal] = useState("");
  const [paidBy, setPaidBy] = useState<Person>(me);
  const [picked, setPicked] = useState<ExpenseCategory | null>(null);
  const [note, setNote] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [scanState, setScanState] = useState<"idle" | "uploading" | "reading" | "done">("idle");
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saving = useRef(false);

  const [lines, setLines] = useState<Line[]>(() =>
    mode === "trip"
      ? shopping
          .filter((i) => i.status === "in_basket")
          .map((i) => ({
            key: key(),
            name: i.name,
            price: null,
            priceText: "",
            quantity: null,
            unit: i.unit ?? null,
            unitPrice: null,
            atHome: FOOD_CATEGORIES.includes(i.category) || (i.category === "Other" && guessAtHome(i.name)),
            pantryCategory: i.category,
            shoppingItemId: i.id,
            onList: true,
          }))
      : [],
  );

  /** Link a new line to a To Buy / basket item, never the same list item twice. */
  const link = (name: string, current: Line[]) => {
    const m = matchShoppingItem(name);
    return m && !current.some((l) => l.shoppingItemId === m.id) ? m : undefined;
  };

  const addLine = () => {
    const n = draft.trim();
    if (!n) return;
    setLines((prev) => {
      if (prev.some((l) => normName(l.name) === normName(n))) return prev;
      const m = link(n, prev);
      const cat = m?.category ?? "Other";
      return [
        ...prev,
        {
          key: key(),
          name: n,
          price: null,
          priceText: "",
          quantity: null,
          unit: null,
          unitPrice: null,
          atHome: FOOD_CATEGORIES.includes(cat) || (cat === "Other" && guessAtHome(n)),
          pantryCategory: cat,
          shoppingItemId: m?.id,
          onList: !!m,
        },
      ];
    });
    setDraft("");
  };

  const applyScan = (r: ScannedReceipt) => {
    if (r.store && !store.trim()) setStore(r.store);
    if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) setDate(r.date);
    if (r.total != null && r.total > 0) setTotal(fmt(r.total));
    setLines((prev) => {
      const next = [...prev];
      for (const it of r.items) {
        const name = it.name.trim();
        if (!name) continue;
        const n = normName(name);
        const same = next.findIndex((l) => {
          const m = normName(l.name);
          return m === n || (m.length >= 3 && n.length >= 3 && (m.includes(n) || n.includes(m)));
        });
        const price = it.lineTotal ?? (it.unitPrice != null && it.quantity != null ? it.unitPrice * it.quantity : it.unitPrice);
        if (same >= 0) {
          const l = next[same]!;
          next[same] = {
            ...l,
            price: price ?? l.price,
            priceText: price != null ? fmt(price) : l.priceText,
            quantity: it.quantity,
            unit: it.unit ?? l.unit,
            unitPrice: it.unitPrice,
            expCat: asExpenseCategory(it.expenseCategory),
            pantryCategory: l.pantryCategory === "Other" ? asCat(it.pantryCategory) : l.pantryCategory,
          };
          continue;
        }
        const m = link(name, next);
        next.push({
          key: key(),
          name,
          price,
          priceText: fmt(price),
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          atHome: it.atHome,
          pantryCategory: m && m.category !== "Other" ? m.category : asCat(it.pantryCategory),
          shoppingItemId: m?.id,
          expCat: asExpenseCategory(it.expenseCategory),
          onList: !!m,
        });
      }
      return next;
    });
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoName(file.name);
    setScanMsg(null);
    setScanState("uploading");
    let path: string;
    try {
      path = await uploadReceipt(file);
      setReceiptPath(path);
    } catch (e) {
      setScanState("idle");
      setReceiptPath(null);
      setScanMsg(`${(e as Error).message} You can still save this expense without it.`);
      return;
    }
    setScanState("reading");
    try {
      const res = await scan({ data: { path } });
      if (res.error || !res.receipt) {
        setScanMsg(`${res.error ?? "Couldn't read the receipt."} The photo is still attached.`);
        setScanState("idle");
        return;
      }
      applyScan(res.receipt);
      setScanState("done");
      setScanMsg(res.receipt.items.length ? `Read ${res.receipt.items.length} items. Please check them below.` : "No items could be read — add them by hand if you like.");
    } catch {
      setScanMsg("Couldn't read the receipt. The photo is still attached.");
      setScanState("idle");
    }
  };

  // Category suggestion: your choice > shop memory > what the items are.
  const remembered = merchantCategory(store);
  const itemCats = (() => {
    const w = new Map<ExpenseCategory, number>();
    for (const l of lines) {
      const c = l.expCat;
      if (c) w.set(c, (w.get(c) ?? 0) + (parseEuro(l.priceText) || 1));
    }
    return [...w.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const fromItems = itemCats[0]?.[0] ?? (mode === "trip" && basketCategories().length === 1 ? basketCategories()[0]! : null);
  const suggested = remembered ?? fromItems;
  const category = picked ?? suggested;
  const amount = parseEuro(total);
  const itemsSum = lines.reduce((s, l) => s + (parseEuro(l.priceText) || 0), 0);
  const busyScan = scanState === "uploading" || scanState === "reading";
  const missing = !(Number.isFinite(amount) && amount > 0) ? "Enter the amount paid." : !category ? "Choose a category." : null;

  const save = async () => {
    if (saving.current || missing) return;
    saving.current = true;
    setBusy(true);
    setErr(null);
    try {
      await savePurchase({
        tripId,
        store,
        date,
        total: amount,
        paidBy,
        category: category!,
        categoryManual: !!picked,
        note: note.trim() || undefined,
        receiptPath,
        fromShoppingTrip: mode === "trip",
        lines: lines
          .filter((l) => l.name.trim())
          .map((l) => {
            const p = parseEuro(l.priceText);
            return { ...l, price: Number.isFinite(p) ? p : null };
          }),
      });
      const home = lines.filter((l) => l.atHome).length;
      onSaved(
        `Saved ${euro(amount)}${lines.length ? ` · ${lines.length} item${lines.length === 1 ? "" : "s"}` : ""}${home ? ` · ${home} to At Home` : ""}`,
      );
    } catch (e) {
      setErr((e as Error).message || "Couldn't save. Please try again.");
      setBusy(false);
      saving.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 backdrop-blur-sm">
      <div className="glass max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" />
        <h2 className="font-display text-2xl">{mode === "trip" ? "Finish Shopping" : "Add expense"}</h2>
        <p className="mt-1 mb-5 text-sm text-ink/55">
          {mode === "trip" ? "Scan the receipt or type the total. Nothing is saved until you confirm." : "For anything bought without the shopping list."}
        </p>

        <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-brand/40 bg-card/50 px-4 py-4 text-sm text-ink/60">
          <span className="min-w-0">
            <span className="block font-semibold text-brand">
              {scanState === "uploading" ? "Uploading photo…" : scanState === "reading" ? "Reading the receipt…" : receiptPath ? "Receipt attached" : "Scan a receipt (optional)"}
            </span>
            <span className="block truncate text-xs text-ink/45">{photoName ?? "We'll read the shop, total and items for you to check."}</span>
          </span>
          <span className="shrink-0 text-xl">{busyScan ? "⏳" : "📷"}</span>
          <input type="file" accept="image/*" className="hidden" disabled={busyScan} onChange={(e) => void onPhoto(e.target.files?.[0])} />
        </label>
        {scanMsg && (
          <p className={`mb-4 rounded-2xl p-3 text-xs ${scanState === "done" ? "bg-herb/10 text-herb" : "bg-accent/15 text-ink/70"}`}>{scanMsg}</p>
        )}

        <label className="eyebrow text-ink/40">{mode === "trip" ? "Store" : "Shop or payee"}</label>
        <input
          value={store}
          placeholder={mode === "trip" ? "e.g. Prisma" : "e.g. Lidl, pharmacy, café"}
          onChange={(e) => setStore(e.target.value)}
          className="mb-4 mt-1.5 w-full rounded-2xl bg-card/80 px-4 py-3.5 text-base outline-none"
        />

        <div className="mb-4 flex gap-2">
          <div className="min-w-0 flex-1">
            <label className="eyebrow text-ink/40">Total (€)</label>
            <input
              inputMode="decimal"
              value={total}
              placeholder="0,00"
              onChange={(e) => setTotal(e.target.value)}
              className="mt-1.5 w-full rounded-2xl bg-card/80 px-4 py-3.5 text-base outline-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="eyebrow text-ink/40">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-2xl bg-card/80 px-3 py-3.5 text-base outline-none"
            />
          </div>
        </div>

        <label className="eyebrow text-ink/40">Who paid</label>
        <div className="mb-4 mt-1.5 flex gap-2">
          {adults.map((p) => (
            <button
              key={p}
              onClick={() => setPaidBy(p)}
              className={`flex-1 rounded-2xl py-3.5 text-sm font-semibold ${
                paidBy === p ? (toneOf(p) === "accent" ? "bg-accent text-accent-foreground" : "bg-brand text-primary-foreground") : "bg-card/80 text-ink/50"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mb-4 rounded-2xl bg-herb/10 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="eyebrow text-herb">Items bought</p>
            {itemsSum > 0 && <p className="text-[11px] text-ink/45">Items add up to {euro(itemsSum)}</p>}
          </div>
          <p className="mt-1 text-xs text-ink/55">Edit names or prices, remove mistakes, add anything missed. 🏠 = add to At Home.</p>
          <div className="mt-3 space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center gap-1.5 rounded-xl bg-card/80 p-1.5">
                <input
                  value={l.name}
                  aria-label="Item name"
                  onChange={(e) => setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, name: e.target.value } : x)))}
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
                />
                {l.onList && <span className="shrink-0 rounded-full bg-herb/15 px-1.5 py-0.5 text-[10px] font-semibold text-herb">list</span>}
                <input
                  value={l.priceText}
                  inputMode="decimal"
                  placeholder="€"
                  aria-label="Price"
                  onChange={(e) => setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, priceText: e.target.value } : x)))}
                  className="w-16 shrink-0 rounded-lg bg-mist/70 px-2 py-2 text-right text-sm outline-none"
                />
                <button
                  onClick={() => setLines((prev) => prev.map((x) => (x.key === l.key ? { ...x, atHome: !x.atHome } : x)))}
                  aria-label={l.atHome ? "Don't add to At Home" : "Add to At Home"}
                  aria-pressed={l.atHome}
                  className={`grid size-9 shrink-0 place-items-center rounded-lg text-base ${l.atHome ? "bg-herb/25" : "bg-mist/50 opacity-40 grayscale"}`}
                >
                  🏠
                </button>
                <button
                  onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  aria-label={`Remove ${l.name}`}
                  className="shrink-0 px-1.5 text-base text-ink/35"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLine()}
              placeholder="Add a missed item"
              className="min-w-0 flex-1 rounded-xl bg-card/80 px-3 py-3 text-sm outline-none placeholder:text-ink/40"
            />
            <button onClick={addLine} className="shrink-0 rounded-xl bg-herb px-4 text-sm font-semibold text-primary-foreground">
              Add
            </button>
          </div>
        </div>

        <label className="eyebrow text-ink/40">Main category</label>
        <p className="mt-1 text-xs text-ink/50">
          {picked
            ? store.trim()
              ? `Your choice — future ${store.trim()} expenses will default to it.`
              : "Your choice."
            : remembered
              ? `Usual category for ${store.trim()}.`
              : fromItems
                ? "Suggested from the items. Tap to change."
                : "Choose a category."}
        </p>
        <div className="mb-4 mt-2 flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setPicked(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === c ? "bg-brand text-primary-foreground" : "bg-card/80 text-ink/60"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {mode === "expense" && (
          <>
            <label className="eyebrow text-ink/40">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything worth remembering"
              className="mb-4 mt-1.5 w-full rounded-2xl bg-card/80 px-4 py-3.5 text-base outline-none"
            />
          </>
        )}

        {err && <p className="mb-3 rounded-2xl bg-rose/10 p-3 text-sm text-rose">{err}</p>}
        {!err && missing && (total || picked) && <p className="mb-3 text-xs text-ink/50">{missing}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-2xl bg-card/80 py-4 text-sm font-semibold text-ink/60">
            Cancel
          </button>
          <button
            disabled={!!missing || busy || busyScan}
            onClick={() => void save()}
            className="flex-1 rounded-2xl bg-brand py-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : busyScan ? "Reading…" : mode === "trip" ? "Confirm receipt" : "Save expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
