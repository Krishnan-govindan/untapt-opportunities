import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  guestIdentityFromValues,
  jsonResponse,
  normalizeEmail,
  normalizeGuestId,
} from "@/lib/guest.server";

type ResearchMode = "saved" | "research";

type ResearchHistoryBody = {
  guest_id?: string;
  owner_email?: string | null;
  mode?: ResearchMode;
  topic?: string;
  total_scanned?: number | null;
  messages?: string[];
  message?: string | null;
  empty?: boolean;
  opportunities?: Json[];
};

const publicSelect =
  "id, created_at, mode, topic, result_count, total_scanned, messages, message, empty, opportunities";

function validMode(value: unknown): value is ResearchMode {
  return value === "saved" || value === "research";
}

function cleanMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export const Route = createFileRoute("/api/research-history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

        const { data, error } = await supabaseAdmin
          .from("research_runs")
          .select(publicSelect)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ history: data ?? [] });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as ResearchHistoryBody | null;
        const guestId = normalizeGuestId(body?.guest_id);
        const ownerEmail =
          typeof body?.owner_email === "string" && body.owner_email.trim()
            ? normalizeEmail(body.owner_email)
            : null;
        const topic = body?.topic?.trim().slice(0, 240);
        const opportunities = Array.isArray(body?.opportunities) ? body.opportunities : null;

        if (!guestId) return jsonResponse({ error: "Valid guest_id is required" }, { status: 400 });
        if (body?.owner_email && !ownerEmail) {
          return jsonResponse(
            { error: "owner_email must be a valid email when provided" },
            { status: 400 },
          );
        }
        if (!validMode(body?.mode)) {
          return jsonResponse({ error: "mode must be saved or research" }, { status: 400 });
        }
        if (!topic) return jsonResponse({ error: "topic is required" }, { status: 400 });
        if (!opportunities) {
          return jsonResponse({ error: "opportunities must be an array" }, { status: 400 });
        }

        const identity = guestIdentityFromValues(ownerEmail, guestId);
        if (!identity)
          return jsonResponse({ error: "Valid guest_id is required" }, { status: 400 });

        const totalScanned =
          typeof body.total_scanned === "number" && Number.isFinite(body.total_scanned)
            ? Math.max(0, Math.round(body.total_scanned))
            : null;

        const { data, error } = await supabaseAdmin
          .from("research_runs")
          .insert({
            guest_id: identity.guestId,
            owner_email: identity.email,
            mode: body.mode,
            topic,
            result_count: opportunities.length,
            total_scanned: totalScanned,
            messages: cleanMessages(body.messages) as Json,
            message: body.message?.trim() || null,
            empty: Boolean(body.empty),
            opportunities: opportunities as Json,
          })
          .select(publicSelect)
          .single();

        if (error) return jsonResponse({ error: error.message }, { status: 500 });
        return jsonResponse({ run: data });
      },
    },
  },
});
