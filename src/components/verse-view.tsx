import { NOTES } from "@/data/edition";
import {
  TERM_NOTES,
  englishRuns,
  glossWord,
  syriacWords,
  type Verse,
  type WordGloss,
} from "@/lib/scripture";

type Props = {
  book: string;
  chapter: number;
  verse: Verse;
  words: boolean;
  face: "both" | "sy" | "en";
  size: 0 | 1 | 2;
  showNotes: boolean;
  onWord: (info: WordGloss | null, surface: string) => void;
  onTerm: (key: string) => void;
  listening?: boolean;
};

const SY = ["text-xl leading-relaxed", "text-2xl leading-relaxed", "text-3xl leading-relaxed"] as const;
const EN = ["text-base leading-relaxed", "text-lg leading-relaxed", "text-xl leading-relaxed"] as const;

export function VerseView({
  book,
  chapter,
  verse,
  words,
  face,
  size,
  showNotes,
  onWord,
  onTerm,
  listening = false,
}: Props) {
  const study = NOTES[`${book}.${chapter}.${verse.v}`];
  const marks: { kind: "Murdock" | "Study"; text: string }[] = [];
  if (showNotes) {
    for (const text of verse.fn ?? []) marks.push({ kind: "Murdock", text });
    if (study) marks.push({ kind: "Study", text: study });
  }
  const showSy = face !== "en";
  const showEn = face !== "sy";
  const missingSy = !verse.sy;
  const missingEn = !verse.en;

  return (
    <article id={`v-${verse.v}`} className={`scroll-mt-40 border-b border-line py-5 ${listening ? "bg-gold-soft -mx-4 px-4" : ""}`}>
      <div className="flex gap-3">
        <span className="w-8 shrink-0 pt-1 text-right font-serif text-sm text-gold">{verse.v}</span>
        <div className="min-w-0 flex-1">
          {showSy && (
            missingSy ? (
              <p className="text-sm text-muted">This verse number is not in the Syriac text.</p>
            ) : (
              <p dir="rtl" lang="syr" className={`font-syriac text-syriac ${SY[size]}`}>
                {verse.sy}
              </p>
            )
          )}
          {words && verse.sy && (
            <div dir="rtl" className="mt-3 flex flex-wrap gap-1.5">
              {syriacWords(verse.sy).map((word, i) => {
                const hit = glossWord(word);
                return (
                  <button
                    key={`${word}-${i}`}
                    type="button"
                    onClick={() => onWord(hit, word)}
                    className="inline-flex min-h-16 min-w-16 max-w-28 flex-col items-center justify-center rounded-md border border-line bg-raised px-1.5 py-1.5 text-center"
                  >
                    <span lang="syr" className="font-syriac text-lg leading-none text-syriac">
                      {word}
                    </span>
                    <span dir="ltr" className="mt-1 text-sm leading-tight text-ink">
                      {hit ? hit.gloss : "·"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {showEn && (
            missingEn ? (
              <p className={`mt-3 text-sm text-muted ${showSy ? "" : ""}`}>
                Murdock does not number this verse by itself. The words sit in the neighboring verse.
              </p>
            ) : (
              <p className={`mt-3 font-serif text-ink ${EN[size]}`}>
                <English text={verse.en} onTerm={onTerm} />
                {marks.map((mark, i) => (
                  <a
                    key={`${mark.kind}-${i}`}
                    href={`#n-${chapter}-${verse.v}-${i}`}
                    className="ml-1 align-super text-xs text-garnet"
                  >
                    {i + 1}
                  </a>
                ))}
              </p>
            )
          )}
          {verse.col && (
            <p className="mt-3 border-l-2 border-gold pl-3 text-sm italic text-muted">{verse.col}</p>
          )}
          {showNotes && marks.length > 0 && (
            <ol className="mt-3 space-y-2">
              {marks.map((mark, i) => (
                <li
                  id={`n-${chapter}-${verse.v}-${i}`}
                  key={`${mark.kind}-${i}`}
                  className="text-sm leading-relaxed text-muted"
                >
                  <span className="mr-2 text-gold">{i + 1}</span>
                  <span className="mr-2 text-garnet">{mark.kind}</span>
                  {mark.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
}

function English({ text, onTerm }: { text: string; onTerm: (key: string) => void }) {
  return (
    <>
      {englishRuns(text).map((run, i) => {
        if (run.kind === "em") {
          return <em key={i}>{run.text}</em>;
        }
        if (run.kind === "term") {
          const note = TERM_NOTES[run.key];
          if (!note) return <span key={i}>{run.text}</span>;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onTerm(run.key)}
              className="border-b border-gold text-ink"
            >
              {run.text}
            </button>
          );
        }
        return <span key={i}>{run.text}</span>;
      })}
    </>
  );
}
