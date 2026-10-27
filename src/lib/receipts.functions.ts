import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScannedItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  discount: number | null;
  atHome: boolean;
  pantryCategory: string;
  expenseCategory: string;
};
export type ScannedReceipt = {
  store: string | null;
  date: string | null;
  total: number | null;
  items: ScannedItem[];
};

const PANTRY = ["Vegetables", "Fruits", "Dairy", "Meat", "Pantry", "Household", "Personal Care", "Child / Toddler", "Other"];
const EXPENSE = ["Groceries", "Household", "Home & Furniture", "Child", "Dining", "Transport", "Utilities", "Health / Pharmacy", "Clothing", "Personal Care", "Entertainment", "Other"];
const num = { type: ["number", "null"] };
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["store", "date", "total", "items"],
  properties: {
    store: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    total: num,
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "unitPrice", "lineTotal", "discount", "atHome", "pantryCategory", "expenseCategory"],
        properties: {
          name: { type: "string" },
          quantity: num,
          unit: { type: ["string", "null"] },
          unitPrice: num,
          lineTotal: num,
          discount: num,
          atHome: { type: "boolean" },
          pantryCategory: { type: "string", enum: PANTRY },
          expenseCategory: { type: "string", enum: EXPENSE },
        },
      },
    },
  },
};

const PROMPT = `Read this shop receipt (often Finnish, e.g. Prisma, K-Market, Lidl, S-Market, IKEA). Return JSON only.
- store: shop name as a family would say it (e.g. "Prisma", "Lidl", "IKEA").
- date: purchase date as YYYY-MM-DD, or null.
- total: amount paid in euros (YHTEENSÄ / Total), or null.
- items: every purchased product line. name: short plain ENGLISH product name (translate/expand Finnish abbreviations, e.g. "MAITO 1L" → "Milk", "BANAANI" → "Bananas", "ASTIANPESUAINE" → "Dish soap"). quantity/unit when shown (kg, l, pcs). unitPrice and lineTotal in euros. discount: positive euro amount of a discount line applied to this item (ALENNUS, Plussa-etu etc.), else null; fold it into lineTotal as the net price.
- Skip non-product lines: deposits (PANTTI) may be listed as items named "Bottle deposit" with atHome false; skip payment, VAT, change, loyalty lines.
- atHome: true for consumables a family keeps at home (food, drinks, spices, detergent, toilet paper, soap, nappies); false for durable objects (furniture, rugs, plates, clothing, tools, decorations).
- pantryCategory and expenseCategory: best fit from the allowed lists.
Never invent items you cannot read.`;

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }): Promise<{ receipt?: ScannedReceipt; error?: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "Receipt reading is not set up yet." };

    // Download through the signed-in user's access — storage rules only allow their own household's receipts.
    const { data: file, error: dlErr } = await context.supabase.storage.from("receipts").download(data.path);
    if (dlErr || !file) return { error: "Couldn't open that receipt photo." };
    if (file.size > 10 * 1024 * 1024) return { error: "That photo is too large to read." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const mime = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
    const dataUrl = `data:${mime};base64,${btoa(bin)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: { format: { type: "json_schema", name: "receipt", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      console.error("receipt AI", res.status, await res.text().catch(() => ""));
      if (res.status === 429) return { error: "Too many requests right now — try again in a minute." };
      if (res.status === 402) return { error: "AI credits have run out. Add credits in Settings → Plans & credits." };
      if (res.status === 403) return { error: "Receipt reading isn't available right now." };
      return { error: "Couldn't read the receipt right now. You can still fill it in by hand." };
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
            if (ev.type === "response.refusal.delta") return { error: "This photo couldn't be read as a receipt." };
          } catch {
            /* partial frame */
          }
        }
      }
    }
    try {
      return { receipt: JSON.parse(text) as ScannedReceipt };
    } catch {
      return { error: "Couldn't read the receipt — please try a clearer photo." };
    }
  });
