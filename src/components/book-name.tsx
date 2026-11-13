/** The number stays with the English title, and the dot stays with the name from this book. */
export function keptTitle(name: string) {
  return name.replace(/^([123]) /, "$1\u00a0");
}

export function bookLabel(name: string, say: string, detail = "") {
  const tail = detail ? `, ${detail}` : "";
  const spoken = name.replace(/^[123]\s+/, "").toLowerCase() === say.toLowerCase() ? name : `${name}, Syriac title ${say}`;
  return `${spoken}${tail}`;
}

export function BookName({ name, say, className = "" }: { name: string; say: string; className?: string }) {
  const same = name.replace(/^[123]\s+/, "").toLowerCase() === say.toLowerCase();
  return (
    <span data-book-name="" className={`book-name flex max-w-full flex-wrap items-baseline leading-snug ${className}`}>
      <span className="whitespace-nowrap">{keptTitle(name)}</span>
      {same ? null : (
        <span className="whitespace-nowrap text-gold">
          <span aria-hidden="true">{"\u00a0·\u00a0"}</span>
          <span className="sr-only">, Syriac title </span>
          {say}
        </span>
      )}
    </span>
  );
}

export function BookSyriac({ sy, className = "" }: { sy: string; className?: string }) {
  return (
    <span data-book-syriac="" className={`book-syriac font-syriac text-syriac ${className}`} lang="syr" dir="rtl">
      {sy}
    </span>
  );
}

/** English name, the name this book prints, then the Syriac. The Syriac drops under them when the row is narrow. */
export function BookTitle({
  name,
  say,
  sy,
  nameClass = "",
  syClass = "",
}: {
  name: string;
  say: string;
  sy: string;
  nameClass?: string;
  syClass?: string;
}) {
  return (
    <span className="book-row flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <BookName name={name} say={say} className={nameClass} />
      <BookSyriac sy={sy} className={syClass} />
    </span>
  );
}
