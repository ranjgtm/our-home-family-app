import { createFileRoute } from "@tanstack/react-router";
import { importLidl } from "@/lib/lidl.server";

// Called once a day by the scheduler. Self-limited to one attempt per 20 hours,
// so outside callers can never make it hit Lidl more often.
export const Route = createFileRoute("/api/public/import-lidl")({
  server: {
    handlers: {
      POST: async () => {
        const r = await importLidl(20);
        return Response.json({ status: r.status, imported: r.imported });
      },
    },
  },
});
