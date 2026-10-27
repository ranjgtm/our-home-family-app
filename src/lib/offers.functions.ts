import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Debug/manual refresh for household members; limited to once per 10 minutes. */
export const refreshLidlOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: member } = await context.supabase
      .from("household_members")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Forbidden");
    const { importLidl } = await import("./lidl.server");
    return importLidl(10 / 60);
  });
