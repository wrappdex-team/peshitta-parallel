import { Modal } from "@/components/modal";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { bookMeta } from "@/data/edition";
import { loadLanguageSearch, loadSearch, loadSyriacSearch, type SearchRow } from "@/lib/scripture";

function scriptOf(query: string) {
  if (/[\u0700-\u074F]/.test(query)) return "syr";
  if (/[\u0590-\u05FF]/.test(query)) return "he";
  if (/[\u0600-\u06FF]/.test(query)) return "ar";
  if (/[\u0370-\u03FF]/.test(query)) return "el";
  if (/[\u0400-\u04FF]/.test(query)) return "ru";
  if (/[àâäéèêëïîôùûüçœæ]/i.test(query)) return "fr";
  return "";
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [syRows, setSyRows] = useState<SearchRow[] | null>(null);
  const [langRows, setLangRows] = useState<Record<string, SearchRow[]>>({});
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    loadSearch()
      .then((data) => {
        if (live) setRows(data);
      })
      .catch(() => {
        if (live) setErr("The concordance did not load.");
      });
    loadSyriacSearch()
      .then((data) => {
        if (live) setSyRows(data);
      })
      .catch(() => {
        if (live) setSyRows([]);
      });
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    const lang = scriptOf(query);
    if (!lang || lang === "syr" || langRows[lang]) return;
    let live = true;
    loadLanguageSearch(lang)
      .then((data) => {
        if (live) setLangRows((prev) => ({ ...prev, [lang]: data }));
      })
      .catch(() => {
        if (live) setLangRows((prev) => ({ ...prev, [lang]: [] }));
      });
    return () => {
      live = false;
    };
  }, [open, q, langRows]);

  const hits = useMemo(() => {
    const query = q.trim();
    if (query.length < 2) return [];
    const syriac = scriptOf(query) === "syr";
    const tongue = scriptOf(query);
    const source = syriac ? syRows : tongue ? langRows[tongue] : rows;
    if (!source) return [];
    const needle = syriac ? query.replace(/[\u0700-\u070d]/g, "") : query.toLowerCase();
    const found: SearchRow[] = [];
    for (const row of source) {
      const hay = syriac ? row[3].replace(/[\u0700-\u070d]/g, "") : row[3].toLowerCase();
      if (hay.includes(needle)) {
        found.push(row);
        if (found.length === 40) break;
      }
    }
    return found;
  }, [q, rows, syRows, langRows]);

  if (!open) return null;

  return (
    <Modal label="Search the New Testament" className="fixed inset-0 z-40 flex items-start justify-center bg-scrim px-4 pt-sheet" onClose={onClose}>
      <div
        className="max-h-sheet w-full max-w-xl overflow-hidden rounded-lg border border-line bg-paper shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line p-3">
          <input
            data-modal-initial
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="A word, in English, Greek, Hebrew, Arabic, French, Russian, or Syriac"
            className="min-w-0 flex-1 bg-transparent font-serif text-lg text-ink outline-none placeholder:text-muted"
          />
          <button type="button" className="min-h-11 shrink-0 px-2 text-garnet" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[56vh] overflow-y-auto">
          {err && <p className="p-4 text-sm text-garnet">{err}</p>}
          {!rows && !err && <p className="p-4 text-sm text-muted">Opening the concordance…</p>}
          {rows && q.trim().length < 2 && (
            <p className="p-4 text-sm text-muted">Type two letters, or a Syriac word.</p>
          )}
          {rows && scriptOf(q) === "he" && !langRows.he && (
            <p className="p-4 text-sm text-muted">Opening the Hebrew…</p>
          )}
          {rows && scriptOf(q) === "el" && !langRows.el && (
            <p className="p-4 text-sm text-muted">Opening the Greek…</p>
          )}
          {rows && scriptOf(q) === "ar" && !langRows.ar && (
            <p className="p-4 text-sm text-muted">Opening the Arabic…</p>
          )}
          {rows && scriptOf(q) === "ru" && !langRows.ru && (
            <p className="p-4 text-sm text-muted">Opening the Russian…</p>
          )}
          {rows && scriptOf(q) === "fr" && !langRows.fr && (
            <p className="p-4 text-sm text-muted">Opening the French…</p>
          )}
          {hits.map(([id, chapter, verse, text]) => {
            const meta = bookMeta(id);
            return (
              <button
                key={`${id}-${chapter}-${verse}`}
                type="button"
                className="block w-full border-b border-line px-4 py-3 text-left"
                onClick={() => {
                  onClose();
                  void navigate({
                    to: "/read/$book/$chapter",
                    params: { book: id, chapter: String(chapter) },
                    hash: `v-${verse}`,
                  });
                }}
              >
                <span className="text-sm text-gold">
                  {meta?.name ?? id} {chapter}:{verse}
                </span>
                <span className={`mt-1 block text-sm leading-relaxed text-ink ${/[\u0700-\u074F]/.test(text) ? "font-syriac text-xl text-syriac" : /[\u0590-\u05FF]/.test(text) ? "font-hebrew text-lg" : /[\u0600-\u06FF]/.test(text) ? "font-arab text-lg" : /[\u0370-\u03FF]/.test(text) ? "font-greek" : /[\u0400-\u04FF]/.test(text) ? "font-cyr" : ""}`} dir={/[\u0700-\u074F\u0590-\u05FF\u0600-\u06FF]/.test(text) ? "rtl" : "ltr"} lang={/[\u0700-\u074F]/.test(text) ? "syr" : /[\u0590-\u05FF]/.test(text) ? "he" : /[\u0600-\u06FF]/.test(text) ? "ar" : /[\u0370-\u03FF]/.test(text) ? "el" : /[\u0400-\u04FF]/.test(text) ? "ru" : "en"}>
                  {text}
                </span>
              </button>
            );
          })}
          {((/[\u0700-\u074F]/.test(q) ? syRows : rows) && q.trim().length >= 2 && hits.length === 0) && (
            <p className="p-4 text-sm text-muted">Nothing in this edition matches that.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
