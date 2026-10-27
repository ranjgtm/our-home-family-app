// Verified retailer-level offer pages. Never build URLs from product names.
export const RETAILER_PAGES = {
  Lidl: "https://www.lidl.fi/c/tarjouslehdet/s10019134",
  "K-Market": "https://www.k-ruoka.fi/kauppa/tarjoushaku",
  Prisma: "https://www.s-kaupat.fi/tuotteet/kampanjat",
} as const;

const HOSTS: Record<string, string> = { Lidl: "lidl.fi", "K-Market": "k-ruoka.fi", Prisma: "s-kaupat.fi" };
const BROKEN = [/^\/?$/, /\/tarjoukset\/?$/, /undefined|null|placeholder|example/i];

/** Returns the URL only if it is https, on the retailer's own domain, and not a known-bad path. */
export function validRetailerUrl(retailer: string, url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = HOSTS[retailer];
    if (u.protocol !== "https:" || !host) return null;
    if (u.hostname !== host && !u.hostname.endsWith("." + host)) return null;
    if (BROKEN.some((r) => r.test(u.pathname))) return null;
    if (retailer === "Lidl" && !/^\/p\/[^/]+\/p\d+$/.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
