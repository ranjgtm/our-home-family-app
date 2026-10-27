import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One occurrence of a calendar event, already expressed in the viewer's timezone. */
export type FeedEvent = {
  person: string;
  title: string;
  date: string; // YYYY-MM-DD
  start: number; // hours, e.g. 9.5
  end: number;
  allDay: boolean;
};

export type SyncResult = {
  events: FeedEvent[];
  feeds: { person: string; ok: boolean; count: number; error?: string }[];
};

const Input = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().max(80).default("UTC"),
  days: z.number().int().min(1).max(62).default(7),
});

const pad = (n: number) => String(n).padStart(2, "0");

type Wall = { y: number; m: number; d: number; h: number; mi: number };

const wallToKey = (w: Wall) => `${w.y}-${pad(w.m)}-${pad(w.d)}`;

/** Unfold RFC 5545 continuation lines. */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && out.length) {
      out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out;
}

function unescape(v: string) {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Wall-clock fields of an instant, in a given IANA timezone. */
function instantToWall(date: Date, timeZone: string): Wall {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
}

type Parsed = { wall: Wall; utc: Date | null; allDay: boolean };

function parseDT(value: string): Parsed | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  const wall: Wall = { y: +y!, m: +mo!, d: +d!, h: h ? +h : 0, mi: mi ? +mi : 0 };
  const allDay = !h;
  const utc = z ? new Date(Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi)) : null;
  return { wall, utc, allDay };
}

const wallDays = (w: Wall) => Math.floor(Date.UTC(w.y, w.m - 1, w.d) / 86400000);
const addDays = (w: Wall, n: number): Wall => {
  const d = new Date(Date.UTC(w.y, w.m - 1, w.d));
  d.setUTCDate(d.getUTCDate() + n);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: w.h, mi: w.mi };
};

/** Pull events from one .ics feed that fall inside [from, to] (inclusive day keys). */
function parseIcs(text: string, timeZone: string, fromDay: number, toDay: number, person: string): FeedEvent[] {
  const lines = unfold(text);
  const events: FeedEvent[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;

  const push = (fields: Record<string, { value: string; params: string }>) => {
    const dtstart = fields["DTSTART"];
    if (!dtstart) return;
    const s = parseDT(dtstart.value);
    if (!s) return;
    const e = fields["DTEND"] ? parseDT(fields["DTEND"].value) : null;
    const title = unescape(fields["SUMMARY"]?.value ?? "Busy");
    if (fields["STATUS"]?.value === "CANCELLED") return;

    const toWall = (p: Parsed) => (p.utc ? instantToWall(p.utc, timeZone) : p.wall);
    const startWall = toWall(s);
    const endWall = e ? toWall(e) : { ...startWall, h: Math.min(23, startWall.h + 1) };

    const durationDays = e ? wallDays(endWall) - wallDays(startWall) : 0;
    const startHour = s.allDay ? 0 : startWall.h + startWall.mi / 60;
    let endHour = s.allDay ? 24 : endWall.h + endWall.mi / 60;
    if (durationDays > 0 && !s.allDay) endHour = 24;
    if (endHour <= startHour) endHour = Math.min(24, startHour + 0.5);

    // Recurrence: simple DAILY / WEEKLY / MONTHLY / YEARLY expansion inside the window.
    const rule = fields["RRULE"]?.value ?? "";
    const offsets: number[] = [];
    if (!rule) {
      offsets.push(0);
    } else {
      const parts = Object.fromEntries(
        rule.split(";").map((p) => {
          const [k, v] = p.split("=");
          return [k?.toUpperCase() ?? "", v ?? ""];
        }),
      );
      const freq = parts["FREQ"] ?? "";
      const interval = Math.max(1, Number(parts["INTERVAL"] ?? 1));
      const untilParsed = parts["UNTIL"] ? parseDT(parts["UNTIL"]) : null;
      const untilDay = untilParsed ? wallDays(untilParsed.utc ? instantToWall(untilParsed.utc, timeZone) : untilParsed.wall) : null;
      const count = parts["COUNT"] ? Number(parts["COUNT"]) : null;
      const stepDays = freq === "DAILY" ? interval : freq === "WEEKLY" ? 7 * interval : 0;
      const base = wallDays(startWall);

      if (stepDays > 0) {
        let n = 0;
        let occurrences = 0;
        while (n < 1000) {
          const day = base + n * stepDays;
          if (day > toDay) break;
          if (untilDay !== null && day > untilDay) break;
          if (count !== null && occurrences >= count) break;
          if (day >= fromDay) offsets.push(n * stepDays);
          occurrences++;
          n++;
        }
      } else if (freq === "MONTHLY" || freq === "YEARLY") {
        for (let n = 0; n < 60; n++) {
          const d = new Date(Date.UTC(startWall.y, startWall.m - 1, startWall.d));
          if (freq === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + n * interval);
          else d.setUTCFullYear(d.getUTCFullYear() + n * interval);
          const day = Math.floor(d.getTime() / 86400000);
          if (day > toDay) break;
          if (untilDay !== null && day > untilDay) break;
          if (day >= fromDay) offsets.push(day - base);
        }
      } else {
        offsets.push(0);
      }
    }

    for (const off of offsets) {
      const spanDays = Math.max(0, durationDays);
      for (let k = 0; k <= Math.min(spanDays, 6); k++) {
        const w = addDays(startWall, off + k);
        const day = wallDays(w);
        if (day < fromDay || day > toDay) continue;
        events.push({
          person,
          title,
          date: wallToKey(w),
          start: spanDays > 0 && k > 0 ? 0 : startHour,
          end: spanDays > 0 && k < spanDays ? 24 : endHour,
          allDay: s.allDay,
        });
      }
    }
  };

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      cur = {};
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (cur) push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const semi = left.indexOf(";");
    const name = (semi < 0 ? left : left.slice(0, semi)).toUpperCase();
    const params = semi < 0 ? "" : left.slice(semi + 1);
    if (["DTSTART", "DTEND", "SUMMARY", "RRULE", "STATUS"].includes(name) && !cur[name]) {
      cur[name] = { value, params };
    }
  }

  return events;
}

/** Reads the household's saved calendar links and returns events for `days` days from weekStart. */
export const syncCalendarFeeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<SyncResult> => {
    // Verify membership as the caller (RLS), then read the household's links privately.
    const { data: member } = await context.supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Not in a household");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: feeds, error } = await supabaseAdmin
      .from("calendar_feeds")
      .select("id, person, ics_url, user_id, show_details")
      .eq("household_id", member.household_id);
    if (error) throw new Error("Could not read your saved calendars");
    if (!feeds?.length) return { events: [], feeds: [] };

    const startParts = data.weekStart.split("-").map(Number);
    const fromDay = Math.floor(Date.UTC(startParts[0]!, startParts[1]! - 1, startParts[2]!) / 86400000);
    const toDay = fromDay + data.days - 1;

    const results: SyncResult = { events: [], feeds: [] };

    for (const feed of feeds) {
      try {
        const url = feed.ics_url.replace(/^webcal:\/\//i, "https://");
        const res = await fetch(url, { headers: { Accept: "text/calendar" } });
        if (!res.ok) throw new Error(`Calendar link returned ${res.status}`);
        const text = await res.text();
        if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link is not a calendar file");
        const hide = feed.user_id !== context.userId && !feed.show_details;
        const evs = parseIcs(text, data.timeZone, fromDay, toDay, feed.person).map((e) =>
          hide ? { ...e, title: "Busy" } : e,
        );
        results.events.push(...evs);
        results.feeds.push({ person: feed.person, ok: true, count: evs.length });
        await supabaseAdmin
          .from("calendar_feeds")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", feed.id);
      } catch (err) {
        results.feeds.push({
          person: feed.person,
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : "Could not read that calendar",
        });
      }
    }

    results.events.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
    return results;
  });
