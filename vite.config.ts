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
  tanstackStart: {
    server: { entry: "server" },
  },
  // Lovable blocks VITE_ prefixed secrets, so APP_VITE_* vars are used instead.
  // Inject them explicitly as import.meta.env.* so client-side code can read them.
  vite: {
    define: {
      "import.meta.env.APP_VITE_APP_SUPABASE_URL": JSON.stringify(
        process.env.APP_VITE_APP_SUPABASE_URL ?? "",
      ),
      "import.meta.env.APP_VITE_APP_SUPABASE_ANON_KEY": JSON.stringify(
        process.env.APP_VITE_APP_SUPABASE_ANON_KEY ?? "",
      ),
    },
  },
});
