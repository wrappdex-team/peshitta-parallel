import { SiteHeader } from "@/components/site-header";
import { SITE_ORIGIN } from "@/lib/site";
import { finishOpenRouterSignIn, type Finish } from "@/studio/oauth";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/connected")({
  head: () => ({
    meta: [{ title: "Studio connection — Injeel" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/connected` }],
  }),
  component: Connected,
});

/** OpenRouter returns here with ?code=… after the reader approves. */
function Connected() {
  const [result, setResult] = useState<Finish | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.search).get("code") ?? "";
    // Drop the one-time code from the address bar and history straight away.
    window.history.replaceState(null, "", "/connected");
    void finishOpenRouterSignIn(code).then((done) => {
      setResult(done);
      if (done.ok) window.setTimeout(() => window.location.assign(done.returnTo), 1200);
    });
  }, []);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader title="Studio" />
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs tracking-widest text-gold">STUDIO · CONNECTIONS</p>
        <h2 className="mt-1 font-serif text-2xl">{!result ? "Connecting OpenRouter…" : result.ok ? "OpenRouter is connected" : "Not connected"}</h2>
        <p role="status" className="mt-3 text-muted">
          {!result ? "One moment." : result.ok ? "The key stays in this tab only. Taking you back to your reading." : result.error}
        </p>
        {result && (
          <a href={result.returnTo} className="mt-6 inline-flex min-h-11 items-center text-garnet">
            Back to reading
          </a>
        )}
      </main>
    </div>
  );
}
