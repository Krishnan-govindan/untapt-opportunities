import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guestIdentityFromRequest, jsonResponse } from "@/lib/guest.server";

export const Route = createFileRoute("/api/guest/prototypes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const identity = guestIdentityFromRequest(request);
        if (!identity)
          return jsonResponse({ error: "Valid guest_id is required" }, { status: 400 });

        const query = supabaseAdmin
          .from("prototypes")
          .select(
            "id, name, status, thumbnail_url, deployed_url, created_at, opportunity_id, source_type, source_idea_id",
          )
          .eq("owner_type", "guest")
          .eq("guest_id", identity.guestId);

        if (identity.email) query.eq("owner_email", identity.email);
        else query.is("owner_email", null);

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ prototypes: data ?? [] });
      },
    },
  },
});
