import { Modal } from "@/components/modal";
import { InfoMark } from "@/components/info-mark";
import { OfflineCopy } from "@/components/offline-copy";
import { ReadingKinds } from "@/components/page-guide";
import { Link } from "@tanstack/react-router";
import { LANGS, languageById, type LangId } from "@/lib/languages";
import { chooseLanguage, chooseSecond } from "@/lib/reading-choice";
import { requestReadingIntro, usePrefs, type Face } from "@/lib/use-prefs";

export function readingLabel(lang: string, lang2: string, face: Face) {
  if (face === "sy") return "Peshitta";
  const name = languageById(lang as LangId).label;
  const second = lang2 !== "none" ? languageById(lang2 as LangId).label : "";
  if (face === "both" && second) return `${name} · Syriac · ${second}`;
  if (face === "both") return `${name} · Syriac`;
  if (second) return `${name} · ${second}`;
  return name;
}

function FaceButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 px-3 ${active ? "text-garnet" : "text-muted"}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function scriptFace(face: string) {
  if (face === "syriac") return "font-syriac text-lg";
  if (face === "arab") return "font-arab text-lg";
  if (face === "hebrew") return "font-hebrew text-lg";
  if (face === "greek") return "font-greek";
  if (face === "cyrl") return "font-cyr";
  return "";
}

/** The same reading controls as a Gospel chapter. */
export function ReadingSheet({
  open,
  onClose,
  onStudio,
  book,
  chapter,
  bookName,
}: {
  open: boolean;
  onClose: () => void;
  onStudio: () => void;
  book?: string;
  chapter?: number;
  bookName?: string;
}) {
  const { prefs, patch } = usePrefs();
  if (!open) return null;
  return (
    <Modal label="Reading" className="fixed inset-0 z-40 flex items-end bg-scrim" onClose={onClose}>
      <div
        className="max-h-sheet w-full overflow-y-auto border-t border-line bg-paper px-5 py-5 pb-safe"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-lg">Reading</h2>
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={onClose}>
              Close
            </button>
          </div>
          <button type="button" className="mb-2 flex min-h-11 items-center text-left text-garnet" onClick={() => requestReadingIntro()}>
            Choose how you read
          </button>
          <Link to="/guide" className="mb-3 inline-flex min-h-11 items-center text-sm text-garnet" onClick={onClose}>
            More in the guide
          </Link>
          <p className="text-xs tracking-widest text-gold">LANGUAGE</p>
          <div className="mt-1 flex flex-wrap">
            {LANGS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={prefs.lang === item.id}
                onClick={() => {
                  const next = chooseLanguage(prefs, item.id);
                  if (next) patch(next);
                }}
                className={`min-h-11 px-3 ${prefs.lang === item.id ? "text-garnet" : "text-muted"} ${scriptFace(item.face)}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs tracking-widest text-gold">PAGE</p>
          <div className="mt-1 flex flex-wrap">
            <FaceButton label="Words" active={prefs.words} onClick={() => patch({ words: !prefs.words })} />
            <FaceButton label="Notes" active={prefs.notes} onClick={() => patch({ notes: !prefs.notes })} />
            <button type="button" className="flex size-11 items-center justify-center" aria-label="Smaller type" onClick={() => patch({ size: Math.max(0, prefs.size - 1) as 0 | 1 | 2 | 3 | 4 })}>
              A−
            </button>
            <button type="button" className="flex size-11 items-center justify-center text-lg" aria-label="Larger type" onClick={() => patch({ size: Math.min(4, prefs.size + 1) as 0 | 1 | 2 | 3 | 4 })}>
              A+
            </button>
            <button type="button" className="flex size-11 items-center justify-center" aria-label="Tighter lines" onClick={() => patch({ line: Math.max(0, prefs.line - 1) as 0 | 1 | 2 })}>
              ≡
            </button>
            <button type="button" className="flex size-11 items-center justify-center" aria-label="Looser lines" onClick={() => patch({ line: Math.min(2, prefs.line + 1) as 0 | 1 | 2 })}>
              ≡+
            </button>
          </div>
          <p className="mt-4 text-xs tracking-widest text-gold">PARALLEL</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">Syriac beside this language, or a second language. Off until you choose it.</p>
          <div className="mt-1 flex flex-wrap">
            <FaceButton label={languageById(prefs.lang).label} active={prefs.face === "tr"} onClick={() => patch({ face: "tr" })} />
            <FaceButton label="Both" active={prefs.face === "both"} onClick={() => patch({ face: "both" })} />
            <FaceButton label="Peshitta" active={prefs.face === "sy"} onClick={() => patch({ face: "sy" })} />
          </div>
          <div className="mt-1 flex flex-wrap">
            <button
              type="button"
              aria-pressed={prefs.lang2 === "none"}
              onClick={() => patch(chooseSecond(prefs, "none"))}
              className={`min-h-11 px-3 ${prefs.lang2 === "none" ? "text-garnet" : "text-muted"}`}
            >
              No second language
            </button>
            {LANGS.filter((item) => item.id !== prefs.lang).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={prefs.lang2 === item.id}
                onClick={() => patch(chooseSecond(prefs, item.id))}
                className={`min-h-11 px-3 ${prefs.lang2 === item.id ? "text-garnet" : "text-muted"} ${scriptFace(item.face)}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {book && bookName ? <OfflineCopy book={book} chapter={chapter} bookName={bookName} /> : null}
          <p className="mt-6 text-xs tracking-widest text-gold">PREMIUM</p>
          <div className="mt-1 flex items-center gap-1">
            <button type="button" className="min-h-11 text-left text-sm text-muted" onClick={onStudio}>
              Studio · AI voice and images
            </button>
            <InfoMark id="studio" />
          </div>
          <ReadingKinds />
        </div>
      </div>
    </Modal>
  );
}
