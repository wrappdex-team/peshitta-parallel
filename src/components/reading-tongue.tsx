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
      className="reading-tongue-shell sticky z-20 mb-6 flex min-h-14 w-full items-stretch border-y border-line bg-paper text-left text-ink hover:bg-gold-soft"
    >
      <span key={pulse} className="reading-tongue flex min-w-0 flex-1 items-center gap-3 px-1 py-2">
        <span className="reading-tongue-bar block h-8 w-[3px] shrink-0 bg-garnet" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate font-serif text-xl leading-none">{label}</span>
          <span className="reading-tongue-rule mt-2 block h-px w-12 bg-gold" aria-hidden />
        </span>
      </span>
      <span className="flex shrink-0 items-center px-3 text-xs tracking-widest text-gold">Language</span>
    </button>
  );
}
