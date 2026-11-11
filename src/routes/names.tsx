import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import registry from "@/data/names.json";
import { SITE_ORIGIN } from "@/lib/site";

type NameRow = {
  sy: string;
  en: string;
  known: string;
  kind: string;
  count: number;
  ref: string;
};

const NAMES = registry.names as NameRow[];

export const Route = createFileRoute("/names")({
  head: () => ({
    meta: [
      { title: "Names — Injeel" },
      {
        name: "description",
        content: "The names printed in the English of this Peshitta, beside the familiar English and the Syriac.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/names` }],
  }),
  component: Names,
});

function Names() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAMES;
    return NAMES.filter((row) =>
      [row.en, row.known, row.sy, row.kind].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <main className="mx-auto min-h-app max-w-3xl px-5 pt-safe pb-page">
      <div className="pt-8">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          Injeel
        </Link>
        <h1 className="mt-6 font-serif text-4xl">Names</h1>
        <p className="mt-4 text-base leading-relaxed">
          These are the names in the English beside the Peshitta. Each one follows the Syriac of that verse. The familiar English is only here so you can find a name. It is not another translation.
        </p>
        <label className="mt-5 block">
          <span className="text-xs tracking-widest text-gold">FIND A NAME</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Peter, Mary, Jerusalem"
            className="mt-2 min-h-11 w-full border border-line bg-raised px-3 text-base"
          />
        </label>
        <p className="mt-3 text-sm text-muted">{rows.length} names</p>
        <ul className="mt-2 border-t border-line">
          {rows.map((row) => (
            <li key={`${row.en}-${row.sy}`} className="border-b border-line py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-xl">{row.en}</span>
                <span className="font-syriac text-2xl text-syriac" lang="syr" dir="rtl">
                  {row.sy}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {row.known === row.en ? row.kind : `${row.known} · ${row.kind}`}
                {" · "}
                {row.count} {row.count === 1 ? "verse" : "verses"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
