import { Link } from "@tanstack/react-router";
import { NOTES } from "@/data/edition";
import { englishPhrases, foreignAt, rangeHits, speechOf, speechRanges, speechSpans, syriacPhrases } from "@/lib/jesus";
import { languageById, type LangId } from "@/lib/languages";
import { SITE_ORIGIN } from "@/lib/site";
import { NAME_CLASS, nameOfSyriac, nameRuns } from "@/lib/names";
import { shareCard, verseShare } from "@/lib/share";
import {
  TERM_NOTES,
  englishRuns,
  glossWord,
  syriacPieces,
  syriacWords,
  type Verse,
  type WordGloss,
  type WordPlace,
} from "@/lib/scripture";
import { useEffect, useRef, useState } from "react";
import { InfoMark } from "@/components/info-mark";

import type { Annotation, Highlight } from "@/lib/annotations";

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
  size: 0 | 1 | 2 | 3 | 4;
  line: 0 | 1 | 2;
  showNotes: boolean;
  annotation?: Annotation;
  onHighlight: () => void;
  onNote: (note: string) => void;
  onBookmark: () => void;
  onWord: (info: WordGloss | null, surface: string, place: WordPlace) => void;
  onTerm: (key: string) => void;
  listening?: boolean;
  chapterEnd?: boolean;
};

const SY = ["text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl"] as const;
const EN = ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"] as const;
const LEADING = ["leading-snug", "leading-relaxed", "leading-loose"] as const;
const HIGHLIGHT: Record<Highlight, string> = {
  gold: "bg-gold-soft",
  garnet: "bg-garnet/10",
  ink: "bg-ink/5",
};

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
  line,
  showNotes,
  annotation,
  onHighlight,
  onNote,
  onBookmark,
  onWord,
  onTerm,
  listening = false,
  chapterEnd = false,
}: Props) {
  const [copied, setCopied] = useState("");
  const articleRef = useRef<HTMLElement>(null);
  const [wordsReady, setWordsReady] = useState(false);
  const place: WordPlace = { book, chapter, verse: verse.v };
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
  const speech = speechOf(book, chapter, verse.v);
  const phrases = englishPhrases(book, chapter, verse.v, verse.en || "");
  const syMark = syriacPhrases(book, chapter, verse.v, verse.sy || "", verse.en || "");
  const syRanges = syMark && verse.sy ? speechRanges(verse.sy, syMark.say, syMark.which) : null;
  const solid = speech?.kind === "whole" && !phrases;
  const ink = solid ? "text-jesus" : "text-ink";
  const sySolid = speech?.kind === "whole" && !syRanges;
  const syColor = sySolid ? "text-jesus" : "text-syriac";

  async function shareVerse() {
    const lines: string[] = [];
    if (showSy && verse.sy) lines.push(verse.sy);
    if (showTr && parallel) lines.push(parallel);
    if (showTr && second && parallel2) lines.push(parallel2);
    const result = await shareCard(verseShare({ bookName, book, chapter, verse: verse.v, lines }));
    setCopied(result === "copied" ? "share" : result === "shared" ? "sent" : "");
    if (result === "copied" || result === "shared") window.setTimeout(() => setCopied(""), 1200);
  }

  async function copy(kind: "link" | "text") {
    const ref = `${bookName} ${chapter}:${verse.v}`;
    const link = `${SITE_ORIGIN}${window.location.pathname}#v-${verse.v}`;
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

  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(annotation?.note ?? "");
  const highlight = annotation?.highlight;

  return (
    <article
      ref={articleRef}
      id={`v-${verse.v}`}
      className={`scroll-mt-40 border-b border-line py-5 ${listening ? "bg-gold-soft -mx-4 px-4" : ""} ${highlight ? HIGHLIGHT[highlight] : ""}`}
    >
      <div className="flex gap-3">
        <a href={`#v-${verse.v}`} className="w-8 shrink-0 pt-1 text-right font-serif text-sm text-gold">
          {verse.v}
          {annotation?.bookmark && <span className="ml-1 text-garnet">•</span>}
        </a>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-end gap-1 text-xs text-muted">
            {verse.v === 1 ? <InfoMark id="marks" align="end" /> : null}
            <button type="button" className="min-h-8 px-1 hover:text-ink" onClick={onHighlight} aria-label="Highlight">
              Mark
            </button>
            <button type="button" className="min-h-8 px-1 hover:text-ink" onClick={onBookmark} aria-label="Bookmark">
              {annotation?.bookmark ? "Saved" : "Save"}
            </button>
            <button type="button" className="min-h-8 px-1 hover:text-ink" onClick={() => setNoteOpen((v) => !v)} aria-label="Note">
              Note
            </button>
          </div>
          {noteOpen && (
            <div className="mb-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="A note for this verse"
                className="w-full rounded border border-line bg-raised p-2 text-sm"
                rows={2}
              />
              <button type="button" className="mt-1 text-sm text-garnet" onClick={() => { onNote(draft); setNoteOpen(false); }}>
                Keep note
              </button>
            </div>
          )}
          {annotation?.note && !noteOpen && <p className="mb-2 text-sm italic text-muted">{annotation.note}</p>}
          {showSy && (
            missingSy ? (
              <p className="text-sm text-muted">This verse number is not in the Syriac text.</p>
            ) : (
              <p dir="rtl" lang="syr" className={`glow font-syriac ${syColor} ${SY[size]} ${LEADING[line]}`}>
                {(() => {
                  let prev = "";
                  let offset = 0;
                  return syriacPieces(verse.sy).map((piece, i) => {
                    const start = offset;
                    offset += piece.text.length;
                    const hot = rangeHits(syRanges, start, offset);
                    if (piece.kind === "space") return <span key={i} className={hot ? "text-jesus" : undefined}>{piece.text}</span>;
                    const named = nameOfSyriac(piece.word, verse.en, prev);
                    prev = piece.word;
                    if (named) {
                      return (
                        <Link
                          key={i}
                          to="/names"
                          hash={named.id}
                          className={`${NAME_CLASS} font-syriac ${hot ? "text-jesus" : ""}`}
                        >
                          {piece.text}
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onWord(glossWord(piece.word, place), piece.word, place)}
                        className={`rounded-sm border-0 bg-transparent px-0.5 font-syriac hover:bg-gold-soft ${hot ? "text-jesus" : "text-inherit"}`}
                      >
                        {piece.text}
                      </button>
                    );
                  });
                })()}
              </p>
            )
          )}
          {words && verse.sy && wordsReady && (
            <div dir="rtl" className="mt-3 flex flex-wrap gap-1.5">
              {(() => {
                let from = 0;
                return syriacWords(verse.sy).map((word, i) => {
                  const hit = glossWord(word, place);
                  const at = verse.sy.indexOf(word, from);
                  const start = at < 0 ? from : at;
                  from = start + word.length;
                  const hot = syRanges ? rangeHits(syRanges, start, start + word.length) : sySolid;
                  return (
                    <button
                      key={`${word}-${i}`}
                      type="button"
                      onClick={() => onWord(hit, word, place)}
                      className="inline-flex max-w-full shrink-0 flex-col items-center gap-1 rounded-md border border-line bg-raised px-2.5 py-2 text-center"
                    >
                      <span lang="syr" dir="rtl" className={`block whitespace-nowrap px-1 font-syriac text-xl leading-normal sm:text-2xl ${hot ? "text-jesus" : "text-syriac"}`}>
                        {word}
                      </span>
                      <span dir="ltr" className="block max-w-40 text-xs leading-snug text-ink">
                        {hit ? hit.gloss : "·"}
                      </span>
                    </button>
                  );
                });
              })()}
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
                line={line}
                ink={ink}
                say={lang === "en" ? phrases : null}
                cut={lang !== "en" && speech?.kind === "whole" && phrases ? foreignAt(parallel || "", lang) : null}
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
                  line={line}
                  ink={ink}
                  say={lang2 === "en" ? phrases : null}
                  cut={lang2 !== "en" && speech?.kind === "whole" && phrases ? foreignAt(parallel2 || "", lang2) : null}
                  marks={[]}
                  chapter={chapter}
                  verse={verse.v}
                  onTerm={onTerm}
                />
              )}
            </div>
          )}
          {chapterEnd ? <span data-chapter-end="" className="block h-px" aria-hidden="true" /> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
            {speech && <span className="mr-2 text-jesus">Words of Y'shua</span>}
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => void shareVerse()}>
              {copied === "sent" ? "Sent" : copied === "share" ? "Copied" : "Share"}
            </button>
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
                  <span className="text-gold">{mark.kind}</span> {mark.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
}

function EnglishBits({ text, onTerm }: { text: string; onTerm: (key: string) => void }) {
  return englishRuns(text).map((run, i) =>
    run.kind === "term" ? (
      <button key={i} type="button" className="font-semibold text-garnet underline decoration-gold/40" onClick={() => onTerm(run.key)}>
        {run.text}
      </button>
    ) : run.kind === "em" ? (
      <em key={i}>{run.text}</em>
    ) : (
      nameRuns(run.text).map((part, j) =>
        part.kind === "name" ? (
          <Link key={`${i}-${j}`} to="/names" hash={part.id} className={NAME_CLASS}>
            {part.text}
          </Link>
        ) : (
          <span key={`${i}-${j}`}>{part.text}</span>
        ),
      )
    ),
  );
}

function Parallel({
  pending,
  text,
  emptyEn,
  lang,
  language,
  size,
  line,
  ink,
  say,
  cut,
  marks,
  chapter,
  verse,
  onTerm,
}: {
  pending: boolean;
  text: string;
  emptyEn: boolean;
  lang: LangId;
  language: ReturnType<typeof languageById>;
  size: 0 | 1 | 2 | 3 | 4;
  line: 0 | 1 | 2;
  ink: string;
  say: string[] | null;
  cut: number | null;
  marks: { kind: string; text: string }[];
  chapter: number;
  verse: number;
  onTerm: (key: string) => void;
}) {
  if (pending) return <p className="text-sm text-muted">Loading…</p>;
  if (!text && emptyEn) return <p className="text-sm text-muted">This verse is empty in the English text.</p>;
  if (!text) return <p className="text-sm text-muted">This verse is not yet in {language.label}.</p>;
  const runs = lang === "en" ? englishRuns(text) : [{ kind: "text" as const, text }];
  const clauses = lang === "en" && say ? speechSpans(text, say) : null;
  const lead = !clauses && cut != null && cut > 0 && cut < text.length ? cut : null;
  const face =
    language.face === "syriac"
      ? "font-syriac"
      : language.face === "arab"
        ? "font-arab"
        : language.face === "hebrew"
          ? "font-hebrew"
          : language.face === "greek"
            ? "font-greek"
            : language.face === "cyrl"
              ? "font-cyr"
              : "";
  return (
    <p className={`${EN[size]} ${LEADING[line]} ${clauses || lead ? "text-ink" : ink} ${face}`} dir={language.dir} lang={language.id === "aii" ? "syr" : language.id}>
      {clauses
        ? clauses.map((span, index) => (
            <span key={index} className={span.red ? "text-jesus" : undefined}>
              <EnglishBits text={span.text} onTerm={onTerm} />
            </span>
          ))
        : lead
          ? (
            <>
              <span>{text.slice(0, lead)}</span>
              <span className="text-jesus">{text.slice(lead)}</span>
            </>
          )
        : runs.map((run, i) =>
            run.kind === "term" ? (
              <button key={i} type="button" className="font-semibold text-garnet underline decoration-gold/40" onClick={() => onTerm(run.key)}>
                {run.text}
              </button>
            ) : run.kind === "em" ? (
              <em key={i}>{run.text}</em>
            ) : lang === "en" ? (
              <EnglishBits key={i} text={run.text} onTerm={onTerm} />
            ) : (
              <span key={i}>{run.text}</span>
            ),
          )}
      {marks.length > 0 && (
        <sup className="text-gold">
          {marks.map((_, i) => (
            <a key={i} href={`#n-${chapter}-${verse}-${i}`} className="ml-0.5">
              {i + 1}
            </a>
          ))}
        </sup>
      )}
    </p>
  );
}
