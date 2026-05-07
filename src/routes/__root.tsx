import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { Header } from "@/components/Header";
import { AgentSidebar } from "@/components/AgentSidebar";
import { AgentProvider } from "@/lib/agent-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-semibold text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          That opportunity doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to feed
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Untapt — Unmonetized startup opportunities" },
      {
        name: "description",
        content:
          "Untapt surfaces unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt complaints.",
      },
      { property: "og:title", content: "Untapt — Unmonetized startup opportunities" },
      {
        property: "og:description",
        content: "Premium feed of unmonetized startup opportunities.",
      },
      { name: "twitter:title", content: "Untapt — Unmonetized startup opportunities" },
      { name: "description", content: "Discover unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt." },
      { property: "og:description", content: "Discover unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt." },
      { name: "twitter:description", content: "Discover unmonetized startup opportunities scraped from Reddit, X, Hacker News, and Product Hunt." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6548ff48-e114-4efb-ac05-1d0d0b0fd7c4/id-preview-eba73940--e6691da0-58a1-4fef-a505-01e86693609e.lovable.app-1778101020841.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6548ff48-e114-4efb-ac05-1d0d0b0fd7c4/id-preview-eba73940--e6691da0-58a1-4fef-a505-01e86693609e.lovable.app-1778101020841.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AgentProvider>
        <div className="min-h-screen">
          <Header />
          <Outlet />
          <AgentSidebar />
          <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "oklch(0.17 0.008 270)",
              border: "1px solid oklch(0.25 0.01 270)",
              color: "oklch(0.97 0.005 270)",
            },
          }}
          />
        </div>
      </AgentProvider>
    </QueryClientProvider>
  );
}
