import { Modal } from "@/components/modal";
import { InfoMark } from "@/components/info-mark";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { usePrefs } from "@/lib/use-prefs";
import {
  bookTitle,
  cachedIndex,
  chipLangs,
  clipParts,
  faceClass,
  foreignScript,
  loadIndex,
  lookupNames,
  plainLabel,
  prepareSearch,
  readReference,
  resultFace,
  resultNote,
  type Placed,
} from "@/lib/search";

type Scope = "all" | "book" | "words";

const memory: { q: string; lang: string | null; scope: Scope; shown: number } = {
  q: "",
  lang: null,
  scope: "all",
  shown: 40,
};

export function SearchPanel({ open, onClose, book }: { open: boolean; onClose: () => void; book?: string }) {
  const navigate = useNavigate();
  const { prefs } = usePrefs();
  const [q, setQ] = useState(memory.q);
  const [picked, setPicked] = useState<string | null>(memory.lang);
  const [scope, setScope] = useState<Scope>(memory.scope);
  const [shown, setShown] = useState(memory.shown);
  const [pack, setPack] = useState<{ lang: string; rows: { book: string; chapter: number; verse: number; text: string }[] } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const lang = picked ?? prefs.lang;
  const syriacLetters = /[\u0700-\u074F]/.test(q);
  const used = syriacLetters && lang !== "aii" ? "sy" : lang;
  const offer = syriacLetters ? null : foreignScript(q, used);
  const scopeNow: Scope = scope === "book" && !book ? "all" : scope;
  const cached = cachedIndex(used);
  const rows = cached ?? (pack?.lang === used ? pack.rows : null);
  const failed = failedFor === used;
  const minChars = syriacLetters ? 1 : 2;
  const wantsIndex = !offer && q.trim().length >= minChars;
  const loading = wantsIndex && !rows && !failed;
  const earlyReference = readReference(q, book);
  const earlyNames = q.trim().length >= 2 ? lookupNames(q) : [];
  const prepared = rows && wantsIndex ? prepareSearch(rows, q, used, scopeNow, book) : null;
  const hits = prepared?.hits.slice(0, shown) ?? [];
  const total = prepared?.hits.length ?? 0;
  const reference = prepared?.reference ?? earlyReference;
  const aliases = prepared?.aliases ?? earlyNames.filter((name) => name.alias);
  const direct = prepared?.direct ?? earlyNames.filter((name) => !name.alias);
  const spellings = [...new Set(aliases.map((name) => name.en))];
  const note = resultNote({
    pending: loading,
    failed,
    label: plainLabel(used),
    query: q,
    total: offer ? 0 : total,
    hasReference: !!reference,
    offer: !!offer,
    named: aliases.length > 0,
  });
  const face = resultFace(used);

  useEffect(() => {
    memory.q = q;
    memory.lang = picked;
    memory.scope = scope;
    memory.shown = shown;
  }, [q, picked, scope, shown]);

  useEffect(() => {
    if (/[\u0700-\u074F]/.test(q) && lang !== "aii" && picked !== "sy") setPicked("sy");
  }, [q, lang, picked]);

  useEffect(() => {
    if (!open || !wantsIndex) return;
    if (cachedIndex(used)) return;
    let live = true;
    setFailedFor(null);
    loadIndex(used)
      .then((next) => {
        if (!live) return;
        setPack({ lang: used, rows: next });
      })
      .catch(() => {
        if (!live) return;
        setFailedFor(used);
      });
    return () => {
      live = false;
    };
  }, [open, used, wantsIndex]);

  function openVerse(place: Placed) {
    onClose();
    void navigate({
      to: "/read/$book/$chapter",
      params: { book: place.book, chapter: String(place.chapter) },
      hash: `v-${place.verse}`,
    });
  }

  function typeQuery(next: string) {
    setQ(next);
    setShown(40);
    setFailedFor(null);
  }

  function clearSearch() {
    setQ("");
    setPicked(null);
    setScope("all");
    setShown(40);
    setFailedFor(null);
  }

  function searchSpelling(spelling: string) {
    setPicked("en");
    setQ(spelling);
    setShown(40);
    setFailedFor(null);
  }

  if (!open) return null;
  const referenceRow = reference ? rows?.find((row) => row.book === reference.book && row.chapter === reference.chapter && row.verse === reference.verse) : null;
  const referenceParts = referenceRow
    ? clipParts(referenceRow.text, prepared?.referenceHit?.start ?? 0, prepared?.referenceHit?.end ?? 0)
    : null;

  return (
    <Modal label="Search the New Testament" className="fixed inset-0 z-40 flex items-start justify-center bg-scrim px-4 pt-sheet" onClose={onClose}>
      <div className="flex max-h-sheet w-full max-w-xl flex-col border border-line bg-paper" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <input
            data-modal-initial
            value={q}
            onChange={(event) => typeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const place = reference ?? hits[0];
              if (place) openVerse(place);
            }}
            placeholder="Word or reference"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-serif text-lg text-ink outline-none placeholder:text-muted"
          />
          {q ? (
            <button type="button" className="min-h-11 shrink-0 px-2 text-garnet" onClick={clearSearch}>
              Clear
            </button>
          ) : null}
          <InfoMark id="search" align="end" />
          <button type="button" className="min-h-11 shrink-0 px-2 text-garnet" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="toolbar-scroll flex gap-1 overflow-x-auto border-b border-line px-2">
          {chipLangs(prefs.lang).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={used === item.id}
              onClick={() => {
                setPicked(item.id);
                setShown(40);
                setFailedFor(null);
              }}
              className={`min-h-11 shrink-0 px-3 ${used === item.id ? "text-garnet" : "text-muted"} ${faceClass(item.face)}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-2">
          <ScopeChip label="All" pressed={scopeNow === "all"} onClick={() => { setScope("all"); setShown(40); }} />
          {book ? <ScopeChip label="This book" pressed={scopeNow === "book"} onClick={() => { setScope("book"); setShown(40); }} /> : null}
          <ScopeChip label="Words of Y'shua" pressed={scopeNow === "words"} onClick={() => { setScope("words"); setShown(40); }} />
        </div>
        <div className="overflow-y-auto">
          {aliases.length > 0 && (
            <p className="border-b border-line px-4 py-3 text-sm leading-relaxed">
              {aliases[0].matched} is <NameLinks names={aliases} onClose={onClose} /> in this book.
              {total === 0 && !loading && !failed && !reference
                ? spellings.map((spelling) => (
                    <button key={spelling} type="button" className="ml-3 min-h-11 text-garnet" onClick={() => searchSpelling(spelling)}>
                      Search {spelling}
                    </button>
                  ))
                : null}
            </p>
          )}
          {aliases.length === 0 && direct.length > 0 && (
            <p className="border-b border-line px-4 py-3 text-sm leading-relaxed">
              <NameLinks names={direct} onClose={onClose} />
            </p>
          )}
          {reference && (
            <button type="button" className="block w-full border-b border-line px-4 py-3 text-left" onClick={() => openVerse(reference)}>
              <span className="text-sm text-gold">
                {bookTitle(reference.book)} {reference.chapter}:{reference.verse}
              </span>
              {referenceParts ? (
                <span className={`mt-1 block text-sm leading-relaxed ${face.className}`} dir={face.dir} lang={face.lang}>
                  {referenceParts.before}
                  {referenceParts.hit ? <span className="text-garnet">{referenceParts.hit}</span> : null}
                  {referenceParts.after}
                </span>
              ) : null}
            </button>
          )}
          {offer && (
            <p className="px-4 py-3 text-sm leading-relaxed">
              These letters are {plainLabel(offer)}.
              <button
                type="button"
                className="ml-3 min-h-11 text-garnet"
                onClick={() => {
                  setPicked(offer);
                  setShown(40);
                  setFailedFor(null);
                }}
              >
                Search {plainLabel(offer)}
              </button>
            </p>
          )}
          {note ? <p className={`px-4 py-3 text-sm leading-relaxed ${failed ? "text-garnet" : "text-muted"}`}>{note}</p> : null}
          {total > 0 && <p className="px-4 pt-3 text-sm text-muted">{Math.min(shown, total)} of {total}.</p>}
          {hits.map((hit) => {
            const parts = clipParts(hit.text, hit.start, hit.end);
            return (
              <button
                key={`${hit.book}-${hit.chapter}-${hit.verse}`}
                type="button"
                className="block w-full border-b border-line px-4 py-3 text-left"
                onClick={() => openVerse(hit)}
              >
                <span className="text-sm text-gold">
                  {bookTitle(hit.book)} {hit.chapter}:{hit.verse}
                </span>
                <span className={`mt-1 block text-sm leading-relaxed ${face.className}`} dir={face.dir} lang={face.lang}>
                  {parts.before}
                  {parts.hit ? <span className="text-garnet">{parts.hit}</span> : null}
                  {parts.after}
                </span>
              </button>
            );
          })}
          {total > shown && (
            <button type="button" className="min-h-11 px-4 text-garnet" onClick={() => setShown((value) => value + 40)}>
              More
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ScopeChip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`min-h-11 shrink-0 px-3 ${pressed ? "text-garnet" : "text-muted"}`}>
      {label}
    </button>
  );
}

function NameLinks({ names, onClose }: { names: { id: string; en: string }[]; onClose: () => void }) {
  const unique = [...new Map(names.map((name) => [name.id, name])).values()];
  return unique.map((name, index) => (
    <span key={name.id}>
      {index > 0 ? (index === unique.length - 1 ? " and " : ", ") : null}
      <Link to="/names" hash={name.id} className="text-garnet" onClick={onClose}>
        {name.en}
      </Link>
    </span>
  ));
}
