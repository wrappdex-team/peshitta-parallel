import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKS, SECTIONS } from "@/data/edition";
import { SealMark } from "@/components/seal-mark";
import { bookProgress, SEAL_MARKS, sealEarned, testamentProgress, timesPhrase, useReadings } from "@/lib/readings";
import { SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/seal")({
  head: () => ({
    meta: [
      { title: "Your reading — Injeel" },
      { name: "robots", content: "noindex, follow" },
      {
        name: "description",
        content: "How much of the Injeel you have read, and the seal for reading the whole New Testament.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/seal` }],
  }),
  component: SealPage,
});

function SealPage() {
  const { counts, ready } = useReadings();
  const whole = testamentProgress(counts);
  const earned = sealEarned(whole.times);
  const percent = whole.times > 0 ? 100 : whole.percent;
  const nextSeal = SEAL_MARKS.find((mark) => mark > whole.times);

  return (
    <main className="mx-auto min-h-app max-w-3xl bg-paper px-5 pt-safe pb-page text-ink">
      <div className="pt-6">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          All books
        </Link>
        <p className="mt-6 text-xs tracking-widest text-gold">YOUR READING</p>
        <h1 className="mt-2 font-serif text-4xl">The seal</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed">
          A chapter is kept when you reach its last line, or when the voice finishes it. This record stays on this device.
        </p>

        <div className="mt-8 flex flex-col items-center border border-line bg-raised px-5 py-8">
          <SealMark times={ready ? whole.times : 0} />
          <p className="mt-4 font-serif text-5xl tabular-nums">{ready ? percent : "–"}%</p>
          <p className="mt-1 text-center text-sm text-muted">of the Injeel</p>
          <p className="mt-4 max-w-sm text-center font-serif text-xl leading-snug">
            {!ready
              ? "Opening the record…"
              : earned === 0
                ? `${whole.touched} of ${whole.chapters} chapters.`
                : earned === 1
                  ? "You have read the whole Injeel."
                  : `You have read the whole Injeel ${timesPhrase(earned)}.`}
          </p>
          {ready && (
            <p className="mt-2 text-center text-sm text-muted">
              {nextSeal ? `The next seal is at ${nextSeal}.` : "A hundred times. The seal is full."}
              {whole.times > 0 ? ` The next time through is ${whole.nextPercent}% along.` : ""}
            </p>
          )}
        </div>

        {ready &&
          SECTIONS.map((section) => (
            <section key={section} className="mt-10">
              <h2 className="text-xs tracking-widest text-gold">{section.toUpperCase()}</h2>
              <ul className="mt-2 border-t border-line">
                {BOOKS.filter((book) => book.section === section).map((book) => {
                  const progress = bookProgress(counts, book.id);
                  return (
                    <li key={book.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2">
                      <span className="min-w-0">
                        <Link
                          to="/read/$book/$chapter"
                          params={{ book: book.id, chapter: "1" }}
                          className="font-serif text-lg"
                        >
                          {book.name}
                        </Link>
                        <span className="mt-0.5 block text-sm text-muted">{bookLine(progress)}</span>
                      </span>
                      <span className="shrink-0 font-serif text-lg tabular-nums text-garnet">
                        {progress.times > 0 ? `×${progress.times}` : progress.ahead > 0 ? `${Math.round((progress.ahead / progress.of) * 100)}%` : "–"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
    </main>
  );
}

function bookLine(progress: { times: number; ahead: number; of: number }) {
  if (progress.times > 0 && progress.ahead > 0) {
    return `Read ${timesPhrase(progress.times)} · ${progress.ahead} of ${progress.of} into the next`;
  }
  if (progress.times > 0) return `Read ${timesPhrase(progress.times)}`;
  if (progress.ahead > 0) return `${progress.ahead} of ${progress.of} chapters`;
  return `${progress.of} chapters`;
}
