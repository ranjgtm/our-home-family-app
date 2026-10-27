import { Plus } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";

import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/AppShell";
import { PurchaseSheet } from "@/components/PurchaseSheet";
import { EXPENSE_CATEGORIES, euro, isoDate, useHome, type Expense, type ExpenseCategory } from "@/lib/home-store";


export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses · Our Home" },
      { name: "description", content: "Household spending in euros, month by month, by category and by who paid." },
      { property: "og:title", content: "Expenses · Our Home" },
      { property: "og:description", content: "Household spending in euros, month by month, by category and by who paid." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Expenses,
});

const CAT_ICON: Record<ExpenseCategory, string> = {
  Groceries: "🥕",
  Household: "🧺",
  "Home & Furniture": "🛋️",
  Child: "🧸",
  Dining: "🍜",
  Transport: "🚋",
  Utilities: "💡",
  "Health / Pharmacy": "💊",
  Clothing: "👕",
  "Personal Care": "🧴",
  Entertainment: "🎟️",
  Other: "✨",
};

const monthKey = (d: Date) => isoDate(d).slice(0, 7);
const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, m! - 1 + n, 1));
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0);
const byCategory = (xs: Expense[]) => {
  const m = new Map<ExpenseCategory, number>();
  for (const e of xs) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return m;
};

function insightsFor(month: string, all: Expense[]): string[] {
  const inMonth = (k: string) => all.filter((e) => e.date.startsWith(k));
  const cur = inMonth(month);
  if (!cur.length) return [];
  const out: string[] = [];
  const prevKey = shiftMonth(month, -1);
  const prev = inMonth(prevKey);

  if (prev.length) {
    const c = byCategory(cur);
    const p = byCategory(prev);
    const diffs = EXPENSE_CATEGORIES.map((cat) => ({ cat, d: (c.get(cat) ?? 0) - (p.get(cat) ?? 0) })).filter((x) => Math.abs(x.d) >= 1);
    const up = [...diffs].sort((a, b) => b.d - a.d)[0];
    const down = [...diffs].sort((a, b) => a.d - b.d)[0];
    if (up && up.d > 0) out.push(`${up.cat} was your largest increase — ${euro(up.d)} more than last month.`);
    if (down && down.d < 0) out.push(`${down.cat} is ${euro(-down.d)} lower than last month.`);
  }

  const prior = [1, 2, 3].map((n) => inMonth(shiftMonth(month, -n)));
  if (prior.every((m) => m.length)) {
    const c = byCategory(cur);
    let best: { cat: ExpenseCategory; pct: number } | null = null;
    for (const cat of EXPENSE_CATEGORIES) {
      const avg = prior.reduce((s, m) => s + (byCategory(m).get(cat) ?? 0), 0) / 3;
      if (avg < 10) continue;
      const pct = (((c.get(cat) ?? 0) - avg) / avg) * 100;
      if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { cat, pct };
    }
    if (best && Math.abs(best.pct) >= 10)
      out.push(`${best.cat} is ${Math.round(Math.abs(best.pct))}% ${best.pct > 0 ? "higher" : "lower"} than your 3-month average.`);
  }

  const trips = cur.filter((e) => e.category === "Groceries" && e.fromShoppingTrip).length;
  if (trips) out.push(`You made ${trips} grocery shopping trip${trips === 1 ? "" : "s"} this month.`);
  return out;
}

function Expenses() {
  const { expenses, adults, deleteExpense, setExpenseCategory, receiptUrl } = useHome();
  const [saved, setSaved] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);


  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => e.date.slice(0, 7)));
    set.add(thisMonth);
    return [...set].sort();
  }, [expenses, thisMonth]);
  const idx = months.indexOf(month);
  const prevMonth = idx > 0 ? months[idx - 1] : undefined;
  const nextMonth = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : undefined;

  const list = expenses.filter((e) => e.date.startsWith(month));
  const total = sum(list);
  const lastKey = shiftMonth(month, -1);
  const lastList = expenses.filter((e) => e.date.startsWith(lastKey));
  const lastTotal = sum(lastList);
  const cats = [...byCategory(list).entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...cats.map((c) => c[1]), 1);
  const perAdult = adults.map((a) => ({ name: a, total: sum(list.filter((e) => e.paidBy === a)) }));
  const insights = insightsFor(month, expenses);
  const diff = total - lastTotal;

  return (
    <>
      <PageHeader eyebrow="Our spending" title="Expenses" />
      {saved && <p role="status" className="mb-4 rounded-2xl bg-herb/15 p-3 text-sm font-semibold text-herb">✓ {saved}</p>}




      <div className="glass mb-4 flex items-center gap-2 rounded-2xl p-1.5">
        <button
          disabled={!prevMonth}
          onClick={() => prevMonth && setMonth(prevMonth)}
          aria-label="Previous month"
          className="grid size-10 place-items-center rounded-xl text-lg text-ink/60 disabled:opacity-25"
        >
          ←
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-display text-lg">{monthLabel(month)}</p>
        <button
          disabled={!nextMonth}
          onClick={() => nextMonth && setMonth(nextMonth)}
          aria-label="Next month"
          className="grid size-10 place-items-center rounded-xl text-lg text-ink/60 disabled:opacity-25"
        >
          →
        </button>
        {month !== thisMonth && (
          <button onClick={() => setMonth(thisMonth)} className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-primary-foreground">
            This month
          </button>
        )}
      </div>

      <Card className="mb-4" tint="peach">
        <p className="eyebrow text-brand">Total</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="font-display text-4xl">{euro(total)}</p>
          <button
            onClick={() => setSheet(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-transform active:scale-95"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Add expense
          </button>
        </div>
        <p className="mt-1 text-xs text-ink/55">
          {lastList.length
            ? `${diff >= 0 ? "+" : "−"}${euro(Math.abs(diff))} vs ${monthLabel(lastKey).split(" ")[0]} (${euro(lastTotal)})`
            : "No expenses recorded the month before."}
          {" · "}
          {list.length} entr{list.length === 1 ? "y" : "ies"}
        </p>
        <div className="mt-4 flex gap-3">
          {perAdult.map((a, i) => (
            <div key={a.name} className={`min-w-0 flex-1 rounded-2xl p-3 ${i === 1 ? "bg-accent/15" : "bg-brand/10"}`}>
              <p className={`truncate text-xs ${i === 1 ? "text-accent" : "text-brand"}`}>{a.name} paid</p>
              <p className={`mt-0.5 text-base font-semibold ${i === 1 ? "text-accent" : "text-brand"}`}>{euro(a.total)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4" tint="sage">
        <h3 className="mb-3 text-sm font-semibold">Spending insights</h3>
        {insights.length ? (
          <ul className="space-y-2">
            {insights.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-ink/75">
                <span className="text-herb">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/50">
            {list.length ? "Not enough history yet for comparisons — insights appear once you have a previous month recorded." : "No spending recorded this month."}
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <h3 className="mb-4 text-sm font-semibold">Categories</h3>
        <div className="space-y-3">
          {cats.length === 0 && <p className="text-sm text-ink/40">No spending this month 🌱</p>}
          {cats.map(([cat, t]) => (
            <div key={cat} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm">
                {CAT_ICON[cat]} {cat}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${(t / maxCat) * 100}%` }} />
              </span>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-ink/60">{euro(t)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-semibold">Transactions</h3>
        <p className="mb-3 text-xs text-ink/40">Tap one to change its category or delete it.</p>
        <div className="space-y-2">
          {list.length === 0 && <p className="text-sm text-ink/40">Tap + Add expense, or finish a shopping trip.</p>}
          {[...list]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map((e) => (
              <div key={e.id} className="rounded-2xl px-1 py-1.5">
                <button
                  onClick={() => {
                    setOpenId(openId === e.id ? null : e.id);
                    setConfirmId(null);
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {CAT_ICON[e.category]} {e.store || e.title}
                    </span>
                    <span className="block truncate text-xs text-ink/45">
                      {e.date} · {e.category} · paid by {e.paidBy}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{euro(e.amount)}</span>
                </button>
                {openId === e.id && (
                  <div className="mt-3 rounded-2xl bg-mist/70 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {EXPENSE_CATEGORIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            setRowErr(null);
                            setExpenseCategory(e.id, c).catch((x: Error) => setRowErr(x.message));
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            e.category === c ? "bg-brand text-primary-foreground" : "bg-card text-ink/60"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {e.store && <p className="mt-2 text-[11px] text-ink/45">Future {e.store} expenses will use the category you pick. Older ones stay as they are.</p>}
                    {rowErr && <p className="mt-2 text-xs text-rose">{rowErr}</p>}
                    {e.receiptPath && (
                      <button
                        onClick={async () => {
                          const url = await receiptUrl(e.receiptPath!);
                          if (url) window.open(url, "_blank", "noopener");
                          else setRowErr("Couldn't open the receipt.");
                        }}
                        className="mt-3 mr-4 text-xs font-semibold text-brand"
                      >
                        View receipt
                      </button>
                    )}
                    {confirmId === e.id ? (
                      <div className="mt-3 rounded-xl bg-rose/10 p-3">
                        <p className="text-sm text-rose">Delete this {euro(e.amount)} expense permanently?</p>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => setConfirmId(null)} className="flex-1 rounded-full bg-card py-2 text-xs font-semibold text-ink/60">
                            Keep
                          </button>
                          <button
                            onClick={() => {
                              setConfirmId(null);
                              setOpenId(null);
                              void deleteExpense(e.id).catch((x: Error) => setRowErr(x.message));
                            }}
                            className="flex-1 rounded-full bg-rose py-2 text-xs font-semibold text-primary-foreground"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(e.id)} className="mt-3 text-xs font-semibold text-rose">
                        Delete expense
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </Card>

      {sheet && (

        <PurchaseSheet
          mode="expense"
          onClose={() => setSheet(false)}
          onSaved={(m) => {
            setSheet(false);
            setMonth(thisMonth);
            setSaved(m);
            setTimeout(() => setSaved(null), 4000);
          }}
        />
      )}
    </>
  );
}
