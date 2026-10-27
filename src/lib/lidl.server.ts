import { validRetailerUrl } from "./retailer-links";
// Server-only Lidl Finland offer importer. Reads public offer pages (no login),
// one request per page, never deletes stored offers.
const BASE = "https://www.lidl.fi";
const UA = "OurHome family app offer importer (low frequency, once per day)";
const MAX_PAGES = 8;

type Row = {
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
  image_source_url: string | null;
  image_source_type: string | null;
  image_last_verified_at: string | null;
  source_url: string | null;
  source_type: string;
  external_id: string;
  last_updated: string;
};

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

const helsinkiDate = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("en-CA", { timeZone: "Europe/Helsinki" });

function category(path: string, analytics: string) {
  const p = path.toLowerCase();
  if (p.includes("hedelmät ja vihannekset")) return "Fruit & vegetables";
  if (/maito|meijeri|juusto|jogurt/.test(p)) return "Dairy";
  if (/liha|kala|broileri/.test(p)) return "Meat / fish";
  if (analytics === "Food") return "Pantry";
  if (/koti|kodinhoito|pesu|siivous|keittiö/.test(p)) return "Household";
  return "Other";
}

const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(d: any, now: string): Row | null {
  const lp = Array.isArray(d.lidlPlus) && d.lidlPlus.length ? d.lidlPlus[0] : null;
  const price = lp?.price ?? d.price;
  if (!price || typeof price.price !== "number" || !d.storeEndDate) return null;
  const title: string = d.fullTitle || d.title;
  if (!title) return null;
  const base: string = price.basePrice?.text ?? "";
  const parts = base.split("|").map((x: string) => x.trim());
  const unitMatch = base.match(/([\d\s]+,\d+|\d+)\s*€\s*\/\s*([a-zA-Zä]+)/);
  const old = price.discount?.deletedPrice ?? price.oldPrice ?? null;
  const pct =
    price.discount?.percentageDiscount ??
    (typeof old === "number" && old > price.price ? Math.round((1 - price.price / old) * 100) : null);
  return {
    retailer: "Lidl",
    product_name: title,
    normalized_name: title.toLowerCase().replace(/\s+\d+([.,]\d+)?\s*(g|kg|ml|l|kpl|cl)\b/g, "").trim(),
    category: category(d.keyfacts?.wonCategoryPrimary ?? "", d.keyfacts?.analyticsCategory ?? ""),
    promo_price: price.price,
    normal_price: typeof old === "number" ? old : null,
    discount_pct: typeof pct === "number" ? pct : null,
    package_size: parts[0] && !parts[0].includes("€") ? parts[0] : null,
    unit_price: unitMatch ? num(unitMatch[1]!) : null,
    unit: unitMatch ? unitMatch[2]! : null,
    starts_on: d.storeStartDate ? helsinkiDate(d.storeStartDate) : null,
    ends_on: helsinkiDate(d.storeEndDate),
    lidl_plus_required: !!lp,
    ...(() => {
      const img: string | null =
        (typeof d.image === "string" && d.image) ||
        d.image_V1?.image ||
        (Array.isArray(d.imageList) && typeof d.imageList[0] === "string" ? d.imageList[0] : null) ||
        null;
      return {
        image_url: img,
        image_source_url: img ? BASE + (d.canonicalUrl ?? d.canonicalPath ?? "") : null,
        image_source_type: img ? "retailer_structured_data" : null,
        image_last_verified_at: img ? now : null,
      };
    })(),
    source_url: validRetailerUrl("Lidl", BASE + (d.canonicalUrl ?? d.canonicalPath ?? "")),
    source_type: "public_page",
    external_id: `${d.productId ?? d.itemId}-${d.storeStartDate ?? ""}`,
    last_updated: now,
  };
}

async function get(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "fi-FI" } });
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.text();
}

export type ImportResult = {
  status: "success" | "failed" | "skipped";
  message: string;
  imported: number;
  lidlPlus: number;
  pages: string[];
};

/** minHours: skip if the last attempt was more recent than this. */
export async function importLidl(minHours: number): Promise<ImportResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: run } = await db.from("offer_import_runs").select("*").eq("retailer", "Lidl").maybeSingle();
  if (run?.last_attempt_at && Date.now() - new Date(run.last_attempt_at).getTime() < minHours * 3600e3) {
    return { status: "skipped", message: "Refreshed recently — try again later.", imported: 0, lidlPlus: 0, pages: [] };
  }
  const now = new Date().toISOString();
  await db.from("offer_import_runs").upsert({ retailer: "Lidl", last_attempt_at: now });

  const pages: string[] = [];
  try {
    const home = await get(BASE + "/");
    const links = [...home.matchAll(/href="(\/c\/[a-z0-9-]*tarjou[a-z0-9-]*\/a\d+)"/g)].map((m) => m[1]!);
    const unique = [...new Set(links)].slice(0, MAX_PAGES);
    if (!unique.length) throw new Error("No offer pages found on lidl.fi (page layout may have changed)");

    const rows = new Map<string, Row>();
    const errors: string[] = [];
    for (const path of unique) {
      try {
        const html = await get(BASE + path);
        pages.push(BASE + path);
        for (const m of html.matchAll(/data-grid-data="([^"]*)"/g)) {
          try {
            const row = toRow(JSON.parse(decode(m[1]!)), now);
            if (row) rows.set(row.external_id, row);
          } catch {
            /* skip unreadable product */
          }
        }
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (!rows.size) throw new Error(errors[0] ?? "No offers could be read from Lidl pages");

    const list = [...rows.values()];
    const { error } = await db.from("supermarket_offers").upsert(list, { onConflict: "retailer,external_id" });
    if (error) throw new Error(error.message);
    const lidlPlus = list.filter((r) => r.lidl_plus_required).length;
    const message = errors.length ? `Some pages failed: ${errors.join("; ")}` : "OK";
    await db.from("offer_import_runs").upsert({
      retailer: "Lidl",
      last_attempt_at: now,
      last_success_at: now,
      status: errors.length ? "partial" : "success",
      message,
      offers_imported: list.length,
      pages_used: pages,
    });
    return { status: "success", message, imported: list.length, lidlPlus, pages };
  } catch (e) {
    const message = (e as Error).message;
    console.error("Lidl import failed:", message);
    await db.from("offer_import_runs").upsert({ retailer: "Lidl", last_attempt_at: now, status: "failed", message });
    return { status: "failed", message, imported: 0, lidlPlus: 0, pages };
  }
}
