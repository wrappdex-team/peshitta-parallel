import { SiteHeader } from "@/components/site-header";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BOOKS } from "@/data/edition";
import { useAnnotations, type Highlight } from "@/lib/annotations";
import { loadBook } from "@/lib/scripture";
import { SITE_ORIGIN } from "@/lib/site";
import { shareCard, verseShare } from "@/lib/share";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — Injeel" },
      { name: "robots", content: "noindex, follow" },
      { name: "description", content: "Verses you have marked, saved, or noted on this device." },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/saved` }],
  }),
  component: Saved,
});

const COLOR: Record<Highlight, string> = { gold: "Gold", garnet: "Garnet", ink: "Ink" };

function clip(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
}

function Saved() {
  const annotations = useAnnotations();
  const rows = annotations.list().filter((row) => row.highlight || row.bookmark || row.note);
  const signature = rows.map((row) => `${row.book}.${row.chapter}.${row.verse}`).join("|");
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!annotations.ready) return;
    let live = true;
    const books = [...new Set(rows.map((row) => row.book))];
    Promise.all(books.map((id) => loadBook(id).then((doc) => ({ id, doc })).catch(() => null))).then((loaded) => {
      if (!live) return;
      const next: Record<string, string> = {};
      for (const row of rows) {
        const doc = loaded.find((item) => item?.id === row.book)?.doc;
        const verse = doc?.chapters[row.chapter - 1]?.find((item) => item.v === row.verse);
        if (verse?.en) next[`${row.book}.${row.chapter}.${row.verse}`] = verse.en;
      }
      setSnippets(next);
    });
    return () => {
      live = false;
    };
  }, [annotations.ready, signature]);

  async function copy(kind: "link" | "text", book: string, chapter: number, verse: number, name: string) {
    const key = `${book}.${chapter}.${verse}`;
    const link = `${SITE_ORIGIN}/read/${book}/${chapter}#v-${verse}`;
    const payload = kind === "link" ? link : `${name} ${chapter}:${verse}\n${snippets[key] ?? ""}`.trim();
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(`${kind}:${key}`);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="min-h-app bg-paper text-ink">
      <SiteHeader title="Saved" subtitle={rows.length ? `${rows.length}` : "This device"} mark="saved" />
      <main className="mx-auto max-w-3xl px-5 pb-page sm:px-8">
        {!annotations.ready ? <p className="mt-8 text-muted">Opening what you kept…</p> : null}
        {annotations.ready && rows.length === 0 ? (
          <p className="mt-8 text-base leading-relaxed">Nothing is marked, saved, or noted on this device.</p>
        ) : null}
        {annotations.ready && rows.length > 0 ? (
        <ul className="mt-4 border-t border-line">
          {rows.map((row) => {
            const key = `${row.book}.${row.chapter}.${row.verse}`;
            const name = BOOKS.find((item) => item.id === row.book)?.name ?? row.book;
            const snippet = snippets[key];
            return (
              <li key={key} className="border-b border-line py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to="/read/$book/$chapter"
                    params={{ book: row.book, chapter: String(row.chapter) }}
                    hash={`v-${row.verse}`}
                    className="font-serif text-lg text-ink"
                  >
                    {name} {row.chapter}:{row.verse}
                  </Link>
                  <span className="shrink-0 text-sm text-gold">
                    {row.highlight ? COLOR[row.highlight] : ""}
                    {row.highlight && row.bookmark ? " · " : ""}
                    {row.bookmark ? "Saved" : ""}
                  </span>
                </div>
                {snippet ? <p className="mt-2 text-base leading-relaxed">{clip(snippet)}</p> : null}
                {row.note ? <p className="mt-2 text-sm italic text-muted">{row.note}</p> : null}
                <div className="mt-1 flex flex-wrap items-center text-sm text-muted">
                  <button type="button" className="min-h-11 px-2" onClick={() => annotations.toggleHighlight(row.book, row.chapter, row.verse)}>
                    {row.highlight ? COLOR[row.highlight] : "Mark"}
                  </button>
                  <button type="button" className="min-h-11 px-2" onClick={() => annotations.toggleBookmark(row.book, row.chapter, row.verse)}>
                    {row.bookmark ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="min-h-11 px-2"
                    onClick={() => {
                      void shareCard(verseShare({ bookName: name, book: row.book, chapter: row.chapter, verse: row.verse, lines: snippet ? [snippet] : [] })).then((result) => {
                        if (result === "copied" || result === "shared") {
                          setCopied(`share:${key}`);
                          window.setTimeout(() => setCopied(""), 1200);
                        }
                      });
                    }}
                  >
                    {copied === `share:${key}` ? "Sent" : "Share"}
                  </button>
                  <button type="button" className="min-h-11 px-2" onClick={() => void copy("text", row.book, row.chapter, row.verse, name)}>
                    {copied === `text:${key}` ? "Copied" : "Copy"}
                  </button>
                  <button type="button" className="min-h-11 px-2" onClick={() => void copy("link", row.book, row.chapter, row.verse, name)}>
                    {copied === `link:${key}` ? "Copied" : "Link"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        ) : null}
      </main>
    </div>
  );
}
