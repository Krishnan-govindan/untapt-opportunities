// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  // Lovable's managed Supabase project is empty; use our own project where real data lives.
  // The anon key is public by design — safe to commit.
  vite: {
    define: {
      "import.meta.env.APP_VITE_APP_SUPABASE_URL": JSON.stringify(
        process.env.APP_VITE_APP_SUPABASE_URL ?? "https://vzbkzfcrixalhqhmjinj.supabase.co",
      ),
      "import.meta.env.APP_VITE_APP_SUPABASE_ANON_KEY": JSON.stringify(
        process.env.APP_VITE_APP_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Ymt6ZmNyaXhhbGhxaG1qaW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTMzMjcsImV4cCI6MjA5MDk4OTMyN30.0olVFng8mo_jBZJgoI2iP44pJlywzFQPF1iHcfrMPjQ",
      ),
    },
  },
});
