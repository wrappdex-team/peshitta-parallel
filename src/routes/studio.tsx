import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { bookMeta } from "@/data/edition";
import { loadBook } from "@/lib/scripture";
import { usePrefs } from "@/lib/use-prefs";
import { setStudioEnabled, useStudioEnabled, type StudioScope, type StudioVerse } from "@/studio/prefs";

const Workspace = lazy(() => import("@/studio/workspace.tsx"));

function versesOf(rows: { v: number; en?: string; sy?: string }[]): StudioVerse[] {
  return rows.map((row) => ({ v: row.v, en: row.en || "", sy: row.sy || undefined }));
}

function scopeOf(book: string, chapter: number, rows: StudioVerse[], verse = 1): StudioScope {
  const last = rows[rows.length - 1]?.v ?? verse;
  const at = Math.min(Math.max(verse, rows[0]?.v ?? 1), last);
  return { book, bookName: bookMeta(book)?.name ?? book, chapter, verses: rows, from: at, to: at };
}

export const Route = createFileRoute("/studio")({
  loader: async () => {
    const doc = await loadBook("john");
    return { fallback: scopeOf("john", 1, versesOf(doc.chapters[0] ?? [])) };
  },
  head: () => ({
    meta: [
      { title: "AI Studio — Injeel" },
      { name: "description", content: "Make a still, a song or a short film from a verse, on your own AI account or with free services." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const { fallback } = Route.useLoaderData();
  const { prefs } = usePrefs();
  const [scope, setScope] = useState(fallback);
  const enabled = useStudioEnabled();
  const navigate = useNavigate();

  useEffect(() => {
    const last = prefs.last;
    if (!last?.book || (last.book === fallback.book && last.chapter === fallback.chapter)) return;
    if (!bookMeta(last.book)) return;
    void loadBook(last.book)
      .then((doc) => {
        const rows = versesOf(doc.chapters[last.chapter - 1] ?? []);
        if (rows.length) setScope(scopeOf(last.book, last.chapter, rows, last.verse));
      })
      .catch(() => {});
  }, [fallback, prefs.last]);

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader title="Studio" />
      <main className="mx-auto max-w-2xl px-4 pb-page sm:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            className="flex min-h-11 items-center gap-2 text-left text-sm"
            onClick={() => setStudioEnabled(!enabled)}
          >
            <span aria-hidden="true" className={`relative inline-block h-5 w-9 border border-line ${enabled ? "bg-garnet" : "bg-raised"}`}>
              <span className={`absolute top-0.5 size-3.5 bg-paper transition-[left] ${enabled ? "left-[18px]" : "left-0.5"}`} />
            </span>
            <span className={enabled ? "text-ink" : "text-muted"}>AI Studio {enabled ? "on" : "off"} in the reader</span>
          </button>
        </div>
        <p className="py-3 text-sm leading-relaxed text-muted">
          Studio is open here even when the reader marks are off. Turn them on to show a quiet feather beside each verse. Connect a provider, or free services, to make a still, a song or a short film. Nothing uses INjeel’s accounts.
        </p>
        <Suspense fallback={<p className="py-6 text-sm text-muted">Opening Studio…</p>}>
          <Workspace scope={scope} onClose={() => void navigate({ to: "/" })} asPage />
        </Suspense>
      </main>
    </div>
  );
}
