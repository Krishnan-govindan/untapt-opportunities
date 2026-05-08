import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guestIdentityFromRequest, jsonResponse } from "@/lib/guest.server";

export const Route = createFileRoute("/api/guest/prototypes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const identity = guestIdentityFromRequest(request);
        if (!identity) return jsonResponse({ error: "Valid guest_id and email are required" }, { status: 400 });

        const { data, error } = await supabaseAdmin
          .from("prototypes")
          .select("id, name, status, thumbnail_url, deployed_url, created_at, opportunity_id")
          .eq("owner_type", "guest")
          .eq("guest_id", identity.guestId)
          .eq("owner_email", identity.email)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ prototypes: data ?? [] });
      },
    },
  },
});
