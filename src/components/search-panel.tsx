import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { bookMeta } from "@/data/edition";
import { loadSearch, type SearchRow } from "@/lib/scripture";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[] | null>(null);
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
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!rows || query.length < 2) return [];
    const found: SearchRow[] = [];
    for (const row of rows) {
      if (row[3].toLowerCase().includes(query)) {
        found.push(row);
        if (found.length === 40) break;
      }
    }
    return found;
  }, [q, rows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-scrim px-4 pt-16" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the New Testament"
        className="max-h-[70vh] w-full max-w-xl overflow-hidden rounded-lg border border-line bg-paper shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line p-3">
          <input
            autoFocus
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search Murdock’s English"
            className="w-full bg-transparent font-serif text-lg text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="max-h-[56vh] overflow-y-auto">
          {err && <p className="p-4 text-sm text-garnet">{err}</p>}
          {!rows && !err && <p className="p-4 text-sm text-muted">Opening the concordance…</p>}
          {rows && q.trim().length < 2 && (
            <p className="p-4 text-sm text-muted">Type two letters. Search runs across all 27 books.</p>
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
                <span className="mt-1 block text-sm leading-relaxed text-ink">{text}</span>
              </button>
            );
          })}
          {rows && q.trim().length >= 2 && hits.length === 0 && (
            <p className="p-4 text-sm text-muted">Nothing in Murdock matches that.</p>
          )}
        </div>
      </div>
    </div>
  );
}
