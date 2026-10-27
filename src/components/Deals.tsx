import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/AppShell";
import { euro, isoDate, useHome } from "@/lib/home-store";
import { refreshLidlOffers } from "@/lib/offers.functions";
import { RETAILER_PAGES, validRetailerUrl } from "@/lib/retailer-links";

export const OFFER_CATEGORIES = [
  "Fruit & vegetables",
  "Dairy",
  "Meat / fish",
  "Pantry",
  "Household",
  "Other",
] as const;

export type Offer = {
  id: string;
  retailer: string;
  product_name: string;
  normalized_name: string;
  category: string;
  promo_price: number;
  normal_price: number | null;
  discount_pct: number | null;
  package_size: string | null;
  unit_price: number | null;
  unit: string | null;
  starts_on: string | null;
  ends_on: string;
  lidl_plus_required: boolean;
  image_url: string | null;
  source_url: string | null;
  store_name: string | null;
};

type Run = {
  last_attempt_at: string | null;
  last_success_at: string | null;
  status: string;
  message: string | null;
  offers_imported: number;
};

// English → Finnish food words (stems), so "Potatoes" can match "Jazzy-peruna".
const FI: Record<string, string[]> = {
  potato: ["peruna"], zucchini: ["kesakurpitsa"], courgette: ["kesakurpitsa"], banana: ["banaani"],
  apple: ["omena"], tomato: ["tomaat"], cucumber: ["kurkku"], carrot: ["porkkana"], onion: ["sipuli"],
  garlic: ["valkosipuli"], milk: ["maito"], cheese: ["juusto"], egg: ["kananmuna", "muna"],
  chicken: ["broiler", "kana"], beef: ["nauta"], pork: ["porsa", "possu", "sika"], fish: ["kala"],
  salmon: ["lohi"], bread: ["leipa"], butter: ["voi"], yogurt: ["jogurt"], yoghurt: ["jogurt"],
  rice: ["riisi"], grape: ["viinirypale", "rypale"], orange: ["appelsiini"], pear: ["paarynaa", "paaryna"],
  lettuce: ["salaatti"], salad: ["salaatti"], spinach: ["pinaatti"], pepper: ["paprika"],
  broccoli: ["parsakaali"], mushroom: ["sieni"], strawberry: ["mansikka"], blueberry: ["mustikka"],
  avocado: ["avokado"], lemon: ["sitruuna"], cabbage: ["kaali"], coffee: ["kahvi"], juice: ["mehu"],
  oat: ["kaura"], flour: ["jauho"], sugar: ["sokeri"], cream: ["kerma"], diaper: ["vaippa"],
  berry: ["marja"], plum: ["luumu"], melon: ["meloni"], cauliflower: ["kukkakaali"], mince: ["jauheliha"],
};

const clean = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
const singular = (w: string) =>
  w.endsWith("ies") ? w.slice(0, -3) + "y" : w.endsWith("oes") ? w.slice(0, -2) : w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w;
const words = (s: string) =>
  clean(s)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d/.test(w) && !["g", "kg", "ml", "l", "kpl", "pack"].includes(w))
    .map(singular);

export function matchKind(item: string, offer: Offer): "exact" | "possible" | null {
  const a = words(item);
  const b = words(offer.normalized_name || offer.product_name);
  if (!a.length || !b.length) return null;
  if (a.join(" ") === b.join(" ")) return "exact";
  const terms = a.flatMap((w) => [w, ...(FI[w] ?? [])]);
  const hit = terms.some((t) => b.some((tok) => (t.length >= 4 ? tok.includes(t) : tok === t)));
  return hit ? "possible" : null;
}

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function useOffers() {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const load = useCallback(async () => {
    const today = isoDate(new Date());
    const [{ data }, { data: r }] = await Promise.all([
      supabase
        .from("supermarket_offers")
        .select(
          "id,retailer,product_name,normalized_name,category,promo_price,normal_price,discount_pct,package_size,unit_price,unit,starts_on,ends_on,lidl_plus_required,image_url,source_url,store_name",
        )
        .gte("ends_on", today)
        .order("ends_on"),
      supabase.from("offer_import_runs").select("*").eq("retailer", "Lidl").maybeSingle(),
    ]);
    setOffers((data ?? []) as Offer[]);
    setRun((r as Run | null) ?? null);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const today = isoDate(new Date());
  const current = (offers ?? []).filter((o) => !o.starts_on || o.starts_on <= today);
  const upcoming = (offers ?? []).filter((o) => o.starts_on && o.starts_on > today);
  return { offers, current, upcoming, run, reload: load };
}

// Finnish → English hints, so a Finnish product name can be recognised at a glance.
const EN: [string, string][] = Object.entries(FI).flatMap(([en, fis]) =>
  fis.map((f) => [f, en] as [string, string]),
);
const EXTRA_EN: [string, string][] = [
  ["mandariini", "mandarin"], ["satsuma", "mandarin"], ["ananas", "pineapple"], ["kinkku", "ham"],
  ["makkara", "sausage"], ["pizza", "pizza"], ["jäätelö", "ice cream"], ["jaatelo", "ice cream"],
  ["keksi", "biscuit"], ["suklaa", "chocolate"], ["pasta", "pasta"], ["nuudeli", "noodles"],
  ["öljy", "oil"], ["oljy", "oil"], ["tuorepuristettu", "fresh juice"], ["pyykki", "laundry"],
  ["pesuaine", "detergent"], ["talouspaperi", "kitchen paper"], ["wc-paperi", "toilet paper"],
  ["hammas", "toothpaste"], ["shampoo", "shampoo"], ["kahvi", "coffee"], ["tee", "tea"],
  ["fileesuikale", "fillet strips"], ["jauheliha", "minced meat"], ["kerma", "cream"],
  ["piirakka", "pie"], ["sampyla", "roll"], ["sämpylä", "roll"], ["vaippa", "diapers"],
];
const ALL_EN = [...EN, ...EXTRA_EN];

function englishHint(name: string) {
  const n = clean(name);
  const hits: string[] = [];
  for (const [fi, en] of ALL_EN)
    if (n.includes(clean(fi)) && !hits.includes(en)) hits.push(en);
  return hits.slice(0, 2).join(" · ");
}

const CAT_ICON: Record<string, string> = {
  All: "🌿",
  "Fruit & vegetables": "🥦",
  Dairy: "🥛",
  "Meat / fish": "🍗",
  Pantry: "🍞",
  Household: "🧴",
  Other: "🛒",
};

const FLYERS = [
  { name: "Lidl", sub: "Current offers", url: RETAILER_PAGES.Lidl, emoji: "🟡" },
  { name: "K-Market", sub: "K-Ruoka offers", url: RETAILER_PAGES["K-Market"], emoji: "🟠" },
  { name: "Prisma", sub: "S-kaupat campaigns", url: RETAILER_PAGES.Prisma, emoji: "🟢" },
];

function FlyerRow() {
  return (
    <div className="mb-5">
      <h3 className="mb-2 px-1 text-sm font-semibold">Retailer offers</h3>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FLYERS.map((f) => (
          <a
            key={f.name}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[8.5rem] shrink-0 items-center gap-2 rounded-2xl border border-ink/10 bg-surface/80 px-3 py-2.5 shadow-soft"
          >
            <span className="text-lg">{f.emoji}</span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm text-ink">{f.name}</span>
              <span className="block truncate text-[11px] text-ink/50">{f.sub}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

export const RETAILERS = ["Lidl", "K-Market", "Prisma"] as const;

function StoreSettings() {
  const { membership } = useHome();
  const hid = membership?.householdId;
  const [k, setK] = useState("");
  const [p, setP] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!hid) return;
    void supabase.from("households").select("preferred_k_store, preferred_s_store").eq("id", hid).maybeSingle()
      .then(({ data }) => { setK(data?.preferred_k_store ?? ""); setP(data?.preferred_s_store ?? ""); });
  }, [hid]);
  const save = async () => {
    if (!hid) return;
    await supabase.from("households").update({ preferred_k_store: k.trim() || null, preferred_s_store: p.trim() || null }).eq("id", hid);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const input = "w-full rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm";
  return (
    <details className="mb-5 rounded-2xl border border-ink/10 bg-surface/80 px-3 py-2.5 shadow-soft">
      <summary className="cursor-pointer text-sm font-semibold">Your stores{k || p ? ` · ${[k, p].filter(Boolean).join(" · ")}` : ""}</summary>
      <div className="mt-3 space-y-2">
        <label className="block text-xs text-ink/60">Preferred K store
          <input className={input} value={k} onChange={(e) => setK(e.target.value)} placeholder="e.g. K-Market Kamppi" />
        </label>
        <label className="block text-xs text-ink/60">Preferred Prisma / S-group store
          <input className={input} value={p} onChange={(e) => setP(e.target.value)} placeholder="e.g. Prisma Itäkeskus" />
        </label>
        <button onClick={save} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">{saved ? "Saved" : "Save stores"}</button>
      </div>
    </details>
  );
}

export function Deals({ listNames }: { listNames: string[] }) {
  const { offers, current, upcoming, run, reload } = useOffers();
  const [cat, setCat] = useState<string>("All");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Offer | null>(null);
  const refresh = useServerFn(refreshLidlOffers);

  const matched = useMemo(() => {
    const rows: { item: string; offer: Offer; kind: "exact" | "possible" }[] = [];
    for (const item of listNames)
      for (const offer of current) {
        const kind = matchKind(item, offer);
        if (kind) rows.push({ item, offer, kind });
      }
    return rows;
  }, [current, listNames]);
  const byItem = useMemo(() => {
    const m = new Map<string, typeof matched>();
    for (const r of matched) m.set(r.item, [...(m.get(r.item) ?? []), r]);
    return [...m.entries()];
  }, [matched]);

  const matchFor = (o: Offer) => matched.find((m) => m.offer.id === o.id);
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
      active ? "bg-herb text-primary-foreground" : "bg-surface/70 text-ink/60"
    }`;

  return (
    <>
      <FlyerRow />
      <StoreSettings />

      {offers === null ? (
        <p className="py-8 text-center text-sm text-ink/50">Loading offers…</p>
      ) : (
        <>
          {byItem.length > 0 && (
            <>
              <h3 className="mb-2 px-1 text-sm font-semibold">Matches for your list</h3>
              <div className="mb-5 space-y-2">
                {byItem.map(([item, rows]) => (
                  <Card key={item}>
                    <p className="font-display text-base text-ink">{item}</p>
                    <ul className="mt-1 space-y-1">
                      {rows.map((r) => (
                        <li key={r.offer.id}>
                          <button onClick={() => setOpen(r.offer)} className="flex w-full items-baseline gap-2 text-left text-sm">
                            <span className="w-16 shrink-0 font-semibold">{r.offer.retailer}</span>
                            <span className="min-w-0 flex-1 truncate text-ink/60">{r.offer.product_name}{r.offer.package_size ? ` · ${r.offer.package_size}` : ""}</span>
                            <span className="shrink-0 font-bold">{euro(Number(r.offer.promo_price))}</span>
                          </button>
                          <span className="ml-16 pl-2 text-[11px] text-ink/45">
                            {r.kind === "exact" ? "Same name" : "Approximate match"}
                            {r.offer.unit_price != null ? ` · ${euro(Number(r.offer.unit_price))}/${r.offer.unit ?? "unit"}` : ""}
                            {r.offer.lidl_plus_required ? " · Lidl Plus" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {new Set(rows.map((r) => r.offer.retailer)).size > 1 && (
                      <p className="mt-1 text-[11px] text-ink/45">Compare sizes and card conditions — not ranked.</p>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}

          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {["All", ...OFFER_CATEGORIES].map((c) => (
              <button key={c} className={chip(cat === c)} onClick={() => setCat(c)}>
                {CAT_ICON[c] ?? "🛒"} {c}
              </button>
            ))}
          </div>

          {RETAILERS.map((r) => {
            const list = current.filter((o) => o.retailer === r && (cat === "All" || o.category === cat));
            const all = showAll[r];
            const shown = all ? list : list.slice(0, 12);
            return (
              <section key={r} className="mb-6">
                <h3 className="mb-2 px-1 text-sm font-semibold">{r} offers · {list.length}</h3>
                {r !== "Lidl" && list.length === 0 ? (
                  <Card tint="sage">
                    <p className="text-sm text-ink/70">{r} offers aren't available yet.</p>
                    <p className="mt-1 text-xs text-ink/50">
                      {r === "K-Market" ? "K-Ruoka" : "S-kaupat"} doesn't allow its offers to be read automatically. Use the {r} link above to browse them.
                    </p>
                  </Card>
                ) : list.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ink/50">No offers in this group.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {shown.map((o) => (
                        <PhotoCard key={o.id} offer={o} match={matchFor(o)} onOpen={setOpen} />
                      ))}
                    </div>
                    {!all && list.length > shown.length && (
                      <button
                        onClick={() => setShowAll({ ...showAll, [r]: true })}
                        className="mt-3 w-full rounded-full bg-surface/80 py-2.5 text-sm font-semibold text-brand shadow-soft"
                      >
                        Show {list.length - shown.length} more
                      </button>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </>
      )}

      {upcoming.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer px-1 text-sm font-semibold text-ink/60">
            Coming soon · {upcoming.length}
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {upcoming.map((o) => (
              <PhotoCard key={o.id} offer={o} match={undefined} onOpen={setOpen} />
            ))}
          </div>
        </details>
      )}

      <div className="mt-6 px-1 text-center text-[11px] text-ink/40">
        {run?.last_success_at
          ? `Lidl offers updated ${new Date(run.last_success_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : "Lidl offers not imported yet"}
        {run?.status === "failed" && " · last refresh failed, showing saved offers"}
        <br />
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await refresh();
              setMsg(r.status === "success" ? `Imported ${r.imported} offers` : r.status === "skipped" ? r.message : `Refresh failed: ${r.message}`);
              await reload();
            } catch {
              setMsg("Refresh failed");
            } finally {
              setBusy(false);
            }
          }}
          className="mt-1 underline decoration-dotted"
        >
          {busy ? "Refreshing…" : "Refresh Lidl offers (debug)"}
        </button>
        {msg && <p className="mt-1">{msg}</p>}
      </div>

      {open && <OfferSheet offer={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Photo({ offer: o, className }: { offer: Offer; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!o.image_url || failed)
    return (
      <div className={`flex items-center justify-center bg-mist text-xs text-ink/45 ${className ?? ""}`}>
        Photo unavailable
      </div>
    );
  return (
    <img
      src={o.image_url}
      alt={o.product_name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-peach/30 object-contain p-1 ${className ?? ""}`}
    />
  );
}

/** Compact visual tile: photo first, then price. */
export function PhotoCard({
  offer: o,
  match,
  onOpen,
}: {
  offer: Offer;
  match: { item: string; kind: "exact" | "possible" } | undefined;
  onOpen: (o: Offer) => void;
}) {
  const hint = englishHint(o.product_name);
  return (
    <button
      onClick={() => onOpen(o)}
      className="relative overflow-hidden rounded-2xl border border-ink/10 bg-surface/80 text-left shadow-soft"
    >
      <div className="relative">
        <Photo offer={o} className="h-28 w-full" />
        {o.discount_pct != null && (
          <span className="absolute left-2 top-2 rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
            −{o.discount_pct}%
          </span>
        )}
        {match && (
          <span className="absolute right-2 top-2 rounded-full bg-herb px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {match.kind === "exact" ? "On list" : "Maybe"}
          </span>
        )}
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="truncate font-display text-sm leading-snug text-ink">{o.product_name}</p>
        {hint && <p className="truncate text-[11px] capitalize text-ink/45">{hint}</p>}
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-base font-bold text-ink">{euro(Number(o.promo_price))}</span>
          {o.normal_price != null && (
            <span className="text-[11px] text-ink/40 line-through">{euro(Number(o.normal_price))}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function OfferSheet({ offer: o, onClose }: { offer: Offer; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30 p-3" onClick={onClose}>
      <div
        className="w-full rounded-3xl bg-surface p-4 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <Photo offer={o} className="mb-3 h-44 w-full rounded-2xl" />
        <p className="text-xs font-semibold text-ink/50">
          {o.retailer}
          {o.store_name ? ` · ${o.store_name}` : o.retailer !== "Lidl" ? " · store not specified" : ""}
          {o.package_size ? ` · ${o.package_size}` : ""}
        </p>
        <p className="font-display text-lg leading-snug text-ink">{o.product_name}</p>
        {englishHint(o.product_name) && (
          <p className="text-sm capitalize text-ink/50">{englishHint(o.product_name)}</p>
        )}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-ink">{euro(Number(o.promo_price))}</span>
          {o.normal_price != null && (
            <span className="text-sm text-ink/40 line-through">{euro(Number(o.normal_price))}</span>
          )}
          {o.discount_pct != null && (
            <span className="text-sm font-semibold text-rose">−{o.discount_pct}%</span>
          )}
        </div>
        {o.unit_price != null && (
          <p className="text-xs text-ink/50">
            {euro(Number(o.unit_price))}/{o.unit ?? "unit"}
          </p>
        )}
        <p className="mt-1 text-xs text-ink/50">
          {o.starts_on && o.starts_on > isoDate(new Date()) ? `From ${fmtDate(o.starts_on)} · ` : ""}
          Valid until {fmtDate(o.ends_on)}
        </p>
        {o.lidl_plus_required && (
          <span className="mt-2 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
            Lidl Plus required
          </span>
        )}
        <div className="mt-4 flex gap-2">
          {(() => {
            const exact = validRetailerUrl(o.retailer, o.source_url);
            const href = exact ?? RETAILER_PAGES[o.retailer as keyof typeof RETAILER_PAGES];
            return href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-full bg-brand py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                {exact ? "View retailer offer ↗" : "View retailer offers ↗"}
              </a>
            ) : null;
          })()}
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-mist py-2.5 text-sm font-semibold text-ink/70"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Row-style card, still used where a single offer is shown inline. */
export function OfferCard({
  offer: o,
  match,
}: {
  offer: Offer;
  match: { item: string; kind: "exact" | "possible" } | undefined;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Photo offer={o} className="h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base leading-snug text-ink">{o.product_name}</p>
          {englishHint(o.product_name) && (
            <p className="truncate text-xs capitalize text-ink/45">{englishHint(o.product_name)}</p>
          )}
          <p className="mt-0.5 text-xs text-ink/50">Valid until {fmtDate(o.ends_on)}</p>
          {match && (
            <span className="mt-1.5 inline-block rounded-full bg-herb/15 px-2.5 py-1 text-xs font-semibold text-herb">
              {match.kind === "exact" ? "On your list" : `Possible match: ${match.item}`}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-ink">{euro(Number(o.promo_price))}</p>
          {o.normal_price != null && (
            <p className="text-xs text-ink/40 line-through">{euro(Number(o.normal_price))}</p>
          )}
          {o.discount_pct != null && <p className="text-xs font-semibold text-rose">−{o.discount_pct}%</p>}
        </div>
      </div>
    </Card>
  );
}
