import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Freq = z.enum(["Often", "Sometimes", "Rarely"]);

const Input = z.object({
  slots: z.array(z.object({ date: z.string(), slot: z.enum(["lunch", "dinner"]) })).min(1).max(14),
  pantry: z.array(z.object({ name: z.string().max(80), status: z.string() })).max(200),
  staples: z.array(z.string().max(80)).max(150).default([]),
  cuisines: z.record(z.string().max(40), Freq).default({}),
  toddler: z.boolean(),
  pantryFirst: z.boolean(),
  avoid: z.array(z.string().max(120)).max(30).default([]),
});

export type SuggestedMeal = {
  date: string;
  slot: "lunch" | "dinner";
  name: string;
  cuisine: string;
  prepMinutes: number;
  atHome: string[];
  staplesUsed: string[];
  missing: string[];
  toddlerNote: string | null;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["meals"],
  properties: {
    meals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "slot", "name", "cuisine", "prepMinutes", "atHome", "staplesUsed", "missing", "toddlerNote"],
        properties: {
          date: { type: "string" },
          slot: { type: "string", enum: ["lunch", "dinner"] },
          name: { type: "string" },
          cuisine: { type: "string", enum: ["Nepali", "Indian / South Asian", "European / Finnish", "International"] },
          prepMinutes: { type: "integer" },
          atHome: { type: "array", items: { type: "string" } },
          staplesUsed: { type: "array", items: { type: "string" } },
          missing: { type: "array", items: { type: "string" } },
          toddlerNote: { type: ["string", "null"] },
        },
      },
    },
  },
};

export const suggestMeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<{ meals: SuggestedMeal[]; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { meals: [], error: "Meal ideas are not set up yet." };

    const pantryText = data.pantry.length
      ? data.pantry.map((p) => `${p.name}${p.status === "Low" ? " (running low)" : ""}`).join(", ")
      : "(empty)";
    const staplesText = data.staples.length ? data.staples.join(", ") : "(none recorded)";
    const cuisineText = Object.entries(data.cuisines)
      .map(([c, f]) => `${c}: ${f}`)
      .join("; ");
    const prompt = [
      "Plan home-cooked meals for a Nepali-origin family living in Finland: two adults and a 2-year-old toddler. One shared family meal per slot, not a separate toddler meal.",
      `Slots to fill (return exactly one meal per slot, same date and slot): ${data.slots.map((s) => `${s.date} ${s.slot}`).join("; ")}.`,
      `Fresh/other food at home: ${pantryText}.`,
      `Kitchen staples at home (spices, grains, pulses, oils, basics): ${staplesText}.`,
      "Priorities: 1) use food already at home first; 2) use kitchen staples freely — list them in staplesUsed, never in missing; 3) keep missing ingredients to a minimum; 4) reuse the same bought ingredients across the week to reduce waste; 5) follow cuisine preferences; 6) keep the plan varied.",
      data.pantryFirst ? "Strongly prefer dishes that the at-home food and staples already cover." : "Pantry items are a helpful starting point, but variety matters more.",
      cuisineText
        ? `Cuisine preferences (Often = several times a week, Sometimes = now and then, Rarely = at most once in a longer plan): ${cuisineText}. Don't force Nepali food every day; include Nepali-style family meals (e.g. dal bhat tarkari, chicken curry, aloo cauli tarkari, chana curry, pulao, khichdi, leftover-veg fried rice, mild keema) when the ingredients make sense. These are examples, not a fixed list.`
        : "",
      "Assume salt, water and plain cooking oil are always available.",
      "atHome must use exact names from the fresh/other food list; staplesUsed must use exact names from the staples list. missing lists short grocery names (e.g. 'Carrots').",
      data.toddler
        ? "Every meal must suit a toddler. For spicy or strongly seasoned dishes, toddlerNote gives one short practical adaptation, e.g. 'Take out the toddler portion before adding chilli', 'Keep achar separate', 'Cut into small soft pieces'. Otherwise toddlerNote may be null."
        : "toddlerNote may be null when no adaptation is needed.",
      "No medical, allergy or nutritional claims. prepMinutes is a realistic estimate. Lunches lighter than dinners.",
      data.avoid.length ? `Do not suggest these: ${data.avoid.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "meal_plan", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      console.error("meal AI", res.status, await res.text().catch(() => ""));
      if (res.status === 429) return { meals: [], error: "Too many requests right now — try again in a minute." };
      if (res.status === 402) return { meals: [], error: "AI credits have run out. Add credits in Settings → Plans & credits." };
      return { meals: [], error: "Couldn't get meal ideas right now." };
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "response.output_text.delta") text += ev.delta;
            if (ev.type === "response.refusal.delta") return { meals: [], error: "No meal ideas could be made for this request." };
          } catch {
            /* partial */
          }
        }
      }
    }
    try {
      const parsed = JSON.parse(text) as { meals: SuggestedMeal[] };
      return { meals: parsed.meals };
    } catch {
      return { meals: [], error: "Couldn't read the meal ideas — please try again." };
    }
  });
