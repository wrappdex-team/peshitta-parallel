import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { bookMeta } from "@/data/edition";
import { NAMES, type NameEntry } from "@/lib/names";
import { SITE_ORIGIN } from "@/lib/site";

function firstPlace(ref: string) {
  const match = /^([a-z0-9]+)\s+(\d+):(\d+)$/.exec(ref);
  if (!match || !bookMeta(match[1])) return null;
  return { book: match[1], chapter: match[2], verse: match[3] };
}

export const Route = createFileRoute("/names")({
  head: () => ({
    meta: [
      { title: "Names — Injeel" },
      {
        name: "description",
        content: "Every person and place in this Peshitta, in the Syriac spelling, the English of this book, and a reading of the letters.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/names` }],
  }),
  component: Names,
});

function Names() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAMES;
    return NAMES.filter((row) =>
      [row.en, row.known, row.say, row.sy, row.kind, row.note, ...(row.forms ?? []), ...(row.spellings ?? [])].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    const read = () => setActive(decodeURIComponent(window.location.hash.replace(/^#/, "")));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (!active) return;
    document.getElementById(active)?.scrollIntoView({ block: "center" });
  }, [active, rows]);

  return (
    <main className="mx-auto min-h-app max-w-3xl px-5 pt-safe pb-page">
      <div className="pt-8">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          Injeel
        </Link>
        <h1 className="mt-6 font-serif text-4xl">Names</h1>
        <p className="mt-4 text-base leading-relaxed">
          Every person and place kept in this Peshitta. The Syriac is the spelling in the text. Beside it is the English this book prints. The reading is the letters, not another translation. A name in the reading opens its place here.
        </p>
        <label className="mt-5 block">
          <span className="text-xs tracking-widest text-gold">FIND A NAME</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Peter, Maryam, Jerusalem"
            className="mt-2 min-h-11 w-full border border-line bg-raised px-3 text-base"
          />
        </label>
        <p className="mt-3 text-sm text-muted">
          {rows.length} {rows.length === 1 ? "name" : "names"}
          {query.trim()
            ? ""
            : ` · ${NAMES.filter((row) => row.kind === "person").length} persons · ${NAMES.filter((row) => row.kind === "place").length} places · ${NAMES.filter((row) => row.kind === "people").length} peoples`}
        </p>
        <ul className="mt-2 border-t border-line">
          {rows.map((row) => (
            <NameStudy key={row.id} row={row} active={active === row.id} />
          ))}
        </ul>
      </div>
    </main>
  );
}

function NameStudy({ row, active }: { row: NameEntry; active: boolean }) {
  const place = firstPlace(row.ref);
  return (
    <li id={row.id} className={`border-b border-line py-4 ${active ? "bg-gold-soft -mx-3 px-3" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-2xl font-semibold">{row.en}</p>
          {row.known !== row.en ? <p className="text-sm text-muted">{row.known}</p> : null}
        </div>
        <p className="font-syriac text-4xl leading-none text-syriac" lang="syr" dir="rtl">
          {row.sy}
        </p>
      </div>
      {row.spellings && row.spellings.filter((spelling) => spelling !== row.sy).length > 0 ? (
        <p className="mt-2 font-syriac text-2xl leading-none text-syriac" lang="syr" dir="rtl">
          {row.spellings.filter((spelling) => spelling !== row.sy).join("  ")}
        </p>
      ) : null}
      <p className="mt-2 text-sm">
        <span className="text-gold">Read</span> {row.say}
      </p>
      <p className="mt-2 text-sm leading-relaxed">{row.note}</p>
      {row.sources?.map((source) => (
        <p key={`${source.script}-${source.text}`} className="mt-2 text-sm leading-relaxed">
          <span className="text-gold">{source.script}</span>{" "}
          <span className={`font-semibold ${source.script === "Greek" ? "font-greek" : source.script === "Hebrew" || source.script === "Aramaic" ? "font-hebrew text-lg" : ""}`}>
            {source.text}
          </span>
          {source.say ? <span className="text-muted"> · {source.say}</span> : null}
          {source.note ? <span> {source.note}</span> : null}
        </p>
      ))}
      <p className="mt-2 text-sm text-muted">
        {row.kind}
        {" · "}
        {row.count} {row.count === 1 ? "verse" : "verses"}
        {place ? (
          <>
            {" · "}
            <Link
              to="/read/$book/$chapter"
              params={{ book: place.book, chapter: place.chapter }}
              hash={`v-${place.verse}`}
              className="text-garnet"
            >
              {row.ref}
            </Link>
          </>
        ) : (
          ` · ${row.ref}`
        )}
      </p>
    </li>
  );
}
