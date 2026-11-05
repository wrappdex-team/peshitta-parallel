import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BOOKS } from "@/data/edition";
import { GOSPELS, isJesus } from "@/lib/jesus";
import { loadBook, type BookFile, type Verse } from "@/lib/scripture";
import { SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/words")({
  head: () => ({
    meta: [
      { title: "Words of Y'shua — Injeel" },
      {
        name: "description",
        content: "The words Y'shua spoke in the Gospels, in classical Syriac beside a modern reading.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/words` }],
  }),
  component: Words,
});

function Words() {
  const [gospel, setGospel] = useState<(typeof GOSPELS)[number]>("matthew");
  const [doc, setDoc] = useState<BookFile | null>(null);
  const [err, setErr] = useState("");
  const meta = BOOKS.find((item) => item.id === gospel);

  useEffect(() => {
    let live = true;
    setDoc(null);
    setErr("");
    loadBook(gospel)
      .then((next) => {
        if (live) setDoc(next);
      })
      .catch(() => {
        if (live) setErr("This Gospel did not open.");
      });
    return () => {
      live = false;
    };
  }, [gospel]);

  const sayings: { chapter: number; verse: Verse }[] = [];
  doc?.chapters.forEach((chapter, index) => {
    for (const verse of chapter) {
      if (verse.sy && isJesus(gospel, index + 1, verse.v)) sayings.push({ chapter: index + 1, verse });
    }
  });

  return (
    <main className="mx-auto min-h-app max-w-3xl bg-paper px-5 pt-safe pb-page text-ink">
      <div className="pt-6">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          All books
        </Link>
        <p className="mt-6 font-syriac text-4xl text-syriac" lang="syr" dir="rtl">
          {meta?.sy}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">Words of Y'shua</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-muted">
          What he said, in the order this Gospel keeps it. Syriac, then the reading.
        </p>
        <div className="toolbar-scroll mt-4 flex gap-1 overflow-x-auto border-b border-line">
          {GOSPELS.map((id) => {
            const book = BOOKS.find((item) => item.id === id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={gospel === id}
                onClick={() => setGospel(id)}
                className={`min-h-11 shrink-0 px-3 ${gospel === id ? "text-garnet" : "text-muted"}`}
              >
                {book?.name ?? id}
              </button>
            );
          })}
        </div>
        {err && <p className="mt-6 text-garnet">{err}</p>}
        {!doc && !err && <p className="mt-6 text-muted">Opening the words…</p>}
        <div className="mt-2">
          {sayings.map(({ chapter, verse }, index) => {
            const showChapter = index === 0 || sayings[index - 1].chapter !== chapter;
            return (
              <article key={`${chapter}-${verse.v}`} className="border-b border-line py-4">
                {showChapter && <p className="mb-2 text-xs tracking-widest text-gold">CHAPTER {chapter}</p>}
                <Link
                  to="/read/$book/$chapter"
                  params={{ book: gospel, chapter: String(chapter) }}
                  hash={`v-${verse.v}`}
                  className="text-sm text-gold"
                >
                  {meta?.name} {chapter}:{verse.v}
                </Link>
                <p dir="rtl" lang="syr" className="mt-2 font-syriac text-2xl leading-normal text-jesus">
                  {verse.sy}
                </p>
                {verse.en && <p className="mt-2 font-serif text-lg leading-relaxed text-jesus">{verse.en}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
