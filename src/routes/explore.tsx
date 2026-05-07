import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/explore")({
  component: Explore,
});

function Explore() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 text-center">
      <p className="text-muted-foreground">Coming soon.</p>
    </main>
  );
}
