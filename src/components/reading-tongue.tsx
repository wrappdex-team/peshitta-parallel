/** The language control. It stays with the text as the page moves. */
export function ReadingTongue({
  label,
  pulse,
  stickyTop,
  onClick,
}: {
  label: string;
  pulse: number;
  stickyTop: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-reading-tongue=""
      onClick={onClick}
      style={{ top: stickyTop }}
      className="sticky z-20 mb-4 flex min-h-12 w-full items-center justify-between gap-3 border border-garnet bg-gold-soft px-4 text-left text-ink"
    >
      <span key={pulse} className="reading-tongue flex min-w-0 flex-1 items-center gap-3">
        <span className="reading-tongue-bar block h-8 w-1 shrink-0 bg-garnet" aria-hidden />
        <span className="truncate font-serif text-lg">{label}</span>
      </span>
      <span className="shrink-0 text-xs tracking-widest text-gold">Language</span>
    </button>
  );
}
