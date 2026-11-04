import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKS } from "@/data/edition";

export const Route = createFileRoute("/study")({ component: Study });

function Study() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-paper px-5 py-8 text-ink">
      <Link to="/" className="text-sm text-garnet">
        All books
      </Link>
      <p className="mt-4 font-syriac text-4xl text-syriac" lang="syr" dir="rtl">
        ܦܫܝܛܬܐ
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">Injell</h1>
      <p className="mt-2 font-serif text-xl text-garnet">The Original Words Kept</p>
      <p className="mt-4 leading-relaxed text-muted">
        Followers of Christ our Lord. The classical Syriac is the 1905 Peshitta, and it stays on the page.
        James Murdock’s English of 1851 is the literal witness of that Syriac. Spanish, Chinese, modern Syriac
        (Sureth), German, and Japanese are study readings made from his English, so they follow the Peshitta
        rather than a Greek New Testament. They are not the historic church Bibles of those languages.
      </p>

      <h2 className="mt-8 font-serif text-2xl">Word for word</h2>
      <p className="mt-2 leading-relaxed">
        Leave Words on. Under each Syriac word is a short gloss from the study lexicon: the ordinary sense of
        that form, with a prefix such as and, of, in, or to pulled off when the stem is known. A dot means the
        form is not glossed. Tap a word for the longer note. This is a reading lexicon, not a claim that every
        English word sits under exactly one Syriac word. Murdock’s sentence is the continuous literal translation.
      </p>

      <h2 className="mt-8 font-serif text-2xl">Murdock’s rules</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
        <li>As literal as English idiom will bear.</li>
        <li>Saxon words rather than Latin ones.</li>
        <li>The old singular: thou, ye, saith.</li>
        <li>Messiah, not Christ. Simon, not Peter. The rock-name he leaves as Cephas.</li>
        <li>Legate for the one who is sent. Vivifier for the life-giver. He still writes baptism, and says the Syriac verb means to make someone stand.</li>
      </ul>
      <p className="mt-3 leading-relaxed text-muted">
        Those English words are tappable in the text. Italics in Murdock are his, usually a word he supplied or
        a reading he did not trust. His own footnotes are marked Murdock. Notes written for this edition, on the
        Aramaic wording, are marked Study.
      </p>

      <h2 className="mt-8 font-serif text-2xl">What “Peshitta” covers</h2>
      <p className="mt-2 leading-relaxed">
        The Peshitta New Testament of the Syriac churches is twenty-two books. It does not include 2 Peter,
        2 John, 3 John, Jude, or Revelation. Those five were translated later. They are in this edition, marked
        “later Syriac,” because a whole New Testament was asked for. Revelation follows John Gwynn’s edition of
        the Crawford manuscript, which the Bible Society printed in 1905. It is not the Peshitta.
      </p>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {BOOKS.filter((b) => b.later).map((b) => (
          <li key={b.id}>
            <Link to="/read/$book/$chapter" params={{ book: b.id, chapter: "1" }} className="text-garnet">
              {b.name}
            </Link>
            {" — "}
            {b.blurb}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-serif text-2xl">Subscriptions</h2>
      <p className="mt-2 leading-relaxed">
        Several books end with a scribe’s closing line: who wrote it, and sometimes in what language and city.
        Murdock translated those lines. They are set apart under the last verse, not treated as another sentence
        of the chapter.
      </p>

      <h2 className="mt-8 font-serif text-2xl">A limit</h2>
      <p className="mt-2 leading-relaxed">
        Where the verse numbers of the Syriac and of Murdock’s edition do not match, one side is blank and says
        so. The words are in the neighboring verse. Nothing here is filled in from a modern translation.
      </p>
    </main>
  );
}
