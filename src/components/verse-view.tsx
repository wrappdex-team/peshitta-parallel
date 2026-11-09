import { NOTES } from "@/data/edition";
import { isJesus } from "@/lib/jesus";
import { languageById, type LangId } from "@/lib/languages";
import {
  TERM_NOTES,
  englishRuns,
  glossWord,
  syriacWords,
  type Verse,
  type WordGloss,
} from "@/lib/scripture";
import { useEffect, useRef, useState } from "react";

type Props = {
  book: string;
  bookName: string;
  chapter: number;
  verse: Verse;
  words: boolean;
  face: "both" | "sy" | "tr";
  lang: LangId;
  parallel: string;
  pending: boolean;
  lang2: LangId | "none";
  parallel2: string;
  pending2: boolean;
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
  bookName,
  chapter,
  verse,
  words,
  face,
  lang,
  parallel,
  pending,
  lang2,
  parallel2,
  pending2,
  size,
  showNotes,
  onWord,
  onTerm,
  listening = false,
}: Props) {
  const [copied, setCopied] = useState("");
  const articleRef = useRef<HTMLElement>(null);
  const [wordsReady, setWordsReady] = useState(false);
  const study = NOTES[`${book}.${chapter}.${verse.v}`];
  const marks: { kind: "Murdock" | "Study"; text: string }[] = [];
  if (showNotes) {
    for (const text of verse.fn ?? []) marks.push({ kind: "Murdock", text });
    if (study) marks.push({ kind: "Study", text: study });
  }
  const showSy = face !== "tr";
  const showTr = face !== "sy";
  const missingSy = !verse.sy;
  const language = languageById(lang);
  const second = lang2 !== "none" ? languageById(lang2) : null;
  const jesus = isJesus(book, chapter, verse.v);
  const ink = jesus ? "text-jesus" : "text-ink";
  const syColor = jesus ? "text-jesus" : "text-syriac";

  async function copy(kind: "link" | "text") {
    const ref = `${bookName} ${chapter}:${verse.v}`;
    const link = `${window.location.origin}${window.location.pathname}#v-${verse.v}`;
    const lines = [ref];
    if (verse.sy) lines.push(verse.sy);
    if (parallel) lines.push(parallel);
    if (second && parallel2) lines.push(parallel2);
    const payload = kind === "link" ? link : lines.join("\n");
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  }

  useEffect(() => {
    if (!words || !verse.sy) {
      setWordsReady(false);
      return;
    }
    const el = articleRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setWordsReady(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setWordsReady(true);
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [words, verse.sy, verse.v]);

  return (
    <article ref={articleRef} id={`v-${verse.v}`} className={`scroll-mt-40 border-b border-line py-5 ${listening ? "bg-gold-soft -mx-4 px-4" : ""}`}>
      <div className="flex gap-3">
        <a href={`#v-${verse.v}`} className="w-8 shrink-0 pt-1 text-right font-serif text-sm text-gold">
          {verse.v}
        </a>
        <div className="min-w-0 flex-1">
          {showSy && (
            missingSy ? (
              <p className="text-sm text-muted">This verse number is not in the Syriac text.</p>
            ) : (
              <p dir="rtl" lang="syr" className={`glow font-syriac ${syColor} ${SY[size]}`}>
                {verse.sy}
              </p>
            )
          )}
          {words && verse.sy && wordsReady && (
            <div dir="rtl" className="mt-3 flex flex-wrap gap-1.5">
              {syriacWords(verse.sy).map((word, i) => {
                const hit = glossWord(word);
                return (
                  <button
                    key={`${word}-${i}`}
                    type="button"
                    onClick={() => onWord(hit, word)}
                    className="inline-flex max-w-full shrink-0 flex-col items-center gap-1 rounded-md border border-line bg-raised px-2.5 py-2 text-center"
                  >
                    <span lang="syr" dir="rtl" className={`block whitespace-nowrap px-1 font-syriac text-xl leading-normal sm:text-2xl ${syColor}`}>
                      {word}
                    </span>
                    <span dir="ltr" className="block max-w-40 text-xs leading-snug text-ink">
                      {hit ? hit.gloss : "·"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {showTr && (
            <div className={second ? "mt-3 grid gap-4 md:grid-cols-2" : ""}>
              <Parallel
                pending={pending}
                text={parallel}
                emptyEn={!verse.en}
                lang={lang}
                language={language}
                size={size}
                ink={ink}
                marks={marks}
                chapter={chapter}
                verse={verse.v}
                onTerm={onTerm}
              />
              {second && (
                <Parallel
                  pending={pending2}
                  text={parallel2}
                  emptyEn={!verse.en}
                  lang={lang2 as LangId}
                  language={second}
                  size={size}
                  ink={ink}
                  marks={[]}
                  chapter={chapter}
                  verse={verse.v}
                  onTerm={onTerm}
                />
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
            {jesus && <span className="mr-2 text-jesus">Words of Y'shua</span>}
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => copy("text")}>
              {copied === "text" ? "Copied" : "Copy"}
            </button>
            <button type="button" className="min-h-11 px-2 text-muted" onClick={() => copy("link")}>
              {copied === "link" ? "Copied" : "Link"}
            </button>
          </div>
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

function Parallel({
  pending,
  text,
  emptyEn,
  lang,
  language,
  size,
  ink,
  marks,
  chapter,
  verse,
  onTerm,
}: {
  pending: boolean;
  text: string;
  emptyEn: boolean;
  lang: LangId;
  language: { dir: string };
  size: 0 | 1 | 2;
  ink: string;
  marks: { kind: string; text: string }[];
  chapter: number;
  verse: number;
  onTerm: (key: string) => void;
}) {
  const typeface =
    lang === "aii"
      ? "font-syriac text-syriac"
      : lang === "ar"
        ? "font-arab"
        : lang === "he"
          ? "font-hebrew"
          : lang === "el"
            ? "font-greek"
            : lang === "ru"
              ? "font-cyr"
              : lang === "zh"
                ? "font-han"
                : lang === "ja"
                  ? "font-kana"
                  : "font-serif";
  if (pending) return <p className="text-sm text-muted">This language is still being set beside the Peshitta.</p>;
  if (!text) {
    return (
      <p className="text-sm text-muted">
        {emptyEn ? "Murdock does not number this verse by itself. The words sit in the neighboring verse." : "This verse has no line in this language yet."}
      </p>
    );
  }
  return (
    <p lang={lang === "aii" ? "syr" : lang} dir={language.dir} className={`glow ${ink} ${typeface} ${EN[size]}`}>
      {lang === "en" ? <English text={text} onTerm={onTerm} /> : text}
      {marks.map((mark, i) => (
        <a key={`${mark.kind}-${i}`} href={`#n-${chapter}-${verse}-${i}`} className="ml-1 align-super text-xs text-garnet">
          {i + 1}
        </a>
      ))}
    </p>
  );
}

function English({ text, onTerm }: { text: string; onTerm: (key: string) => void }) {
  return (
    <>
      {englishRuns(text).map((run, i) => {
        if (run.kind === "em") return <em key={i}>{run.text}</em>;
        if (run.kind === "term") {
          const note = TERM_NOTES[run.key];
          if (!note) return <span key={i}>{run.text}</span>;
          return (
            <button key={i} type="button" onClick={() => onTerm(run.key)} className="border-b border-gold">
              {run.text}
            </button>
          );
        }
        return <span key={i}>{run.text}</span>;
      })}
    </>
  );
}
