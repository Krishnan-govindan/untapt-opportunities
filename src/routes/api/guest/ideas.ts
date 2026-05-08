import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  guestIdentityFromRequest,
  guestIdentityFromValues,
  jsonResponse,
} from "@/lib/guest.server";

type IdeaBody = {
  id?: string;
  guest_id?: string;
  owner_email?: string;
  title?: string;
  description?: string;
  category?: string;
  video_url?: string | null;
  research_results?: Json | null;
};

const ideaSelect =
  "id, user_id, owner_email, guest_id, owner_type, title, description, category, tags, files, video_url, research_results, created_at, updated_at";

function scopedGuestIdeas(guestId: string, email: string | null) {
  const query = supabaseAdmin
    .from("user_ideas")
    .select(ideaSelect)
    .eq("owner_type", "guest")
    .eq("guest_id", guestId);

  if (email) query.eq("owner_email", email);
  else query.is("owner_email", null);

  return query.order("created_at", { ascending: false });
}

export const Route = createFileRoute("/api/guest/ideas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const identity = guestIdentityFromRequest(request);
        if (!identity)
          return jsonResponse({ error: "Valid guest_id is required" }, { status: 400 });

        const { data, error } = await scopedGuestIdeas(identity.guestId, identity.email);
        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ ideas: data ?? [] });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as IdeaBody | null;
        const identity = guestIdentityFromValues(body?.owner_email, body?.guest_id);
        const title = body?.title?.trim();
        if (!identity || !title) {
          return jsonResponse({ error: "Valid guest_id and title are required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
          .from("user_ideas")
          .insert({
            user_id: null,
            owner_type: "guest",
            owner_email: identity.email,
            guest_id: identity.guestId,
            title,
            description: body?.description?.trim() ?? "",
            category: body?.category?.trim() || "uncategorized",
            video_url: body?.video_url || null,
          })
          .select(ideaSelect)
          .single();

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ idea: data });
      },
      PATCH: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as IdeaBody | null;
        const identity = guestIdentityFromValues(body?.owner_email, body?.guest_id);
        if (!identity || !body?.id) {
          return jsonResponse({ error: "Valid guest_id and id are required" }, { status: 400 });
        }

        const patch: Record<string, unknown> = {};
        if ("research_results" in body) patch.research_results = body.research_results ?? null;
        if ("video_url" in body) patch.video_url = body.video_url || null;
        if (body.title?.trim()) patch.title = body.title.trim();
        if (typeof body.description === "string") patch.description = body.description.trim();
        if (body.category?.trim()) patch.category = body.category.trim();

        let query = supabaseAdmin
          .from("user_ideas")
          .update(patch)
          .eq("id", body.id)
          .eq("owner_type", "guest")
          .eq("guest_id", identity.guestId);

        if (identity.email) query = query.eq("owner_email", identity.email);
        else query = query.is("owner_email", null);

        const { data, error } = await query.select(ideaSelect).single();

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ idea: data });
      },
      DELETE: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as IdeaBody | null;
        const identity = guestIdentityFromValues(body?.owner_email, body?.guest_id);
        if (!identity || !body?.id) {
          return jsonResponse({ error: "Valid guest_id and id are required" }, { status: 400 });
        }

        let query = supabaseAdmin
          .from("user_ideas")
          .delete()
          .eq("id", body.id)
          .eq("owner_type", "guest")
          .eq("guest_id", identity.guestId);

        if (identity.email) query = query.eq("owner_email", identity.email);
        else query = query.is("owner_email", null);

        const { error } = await query;

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ ok: true });
      },
    },
  },
});
