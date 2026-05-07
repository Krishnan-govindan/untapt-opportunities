import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/build/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const jobId = new URL(request.url).searchParams.get("job_id");

        if (!jobId) {
          return new Response(JSON.stringify({ error: "job_id required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabaseAdmin
          .from("prototypes")
          .select("id, status, deployed_url, name, created_at")
          .eq("id", jobId)
          .maybeSingle();

        if (error || !data) {
          return new Response(JSON.stringify({ error: "Job not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
