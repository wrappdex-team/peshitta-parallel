const KINDS: [string, string][] = [
  ["Text", "The Syriac on the page."],
  ["Reading", "The language beside the Syriac, or in its place."],
  ["Gloss", "The line under a Syriac word. It does not replace the verse."],
  ["Edition note", "A note on the wording. Shown when Notes are on."],
  ["Your note", "The line you write on a verse. Shown when Notes are on."],
];

/** The five kinds of text, once, inside the Reading sheet. */
export function ReadingKinds() {
  return (
    <dl className="mt-6 border-t border-line pt-4">
      {KINDS.map(([term, text]) => (
        <div key={term} className="mt-2 grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3 text-sm leading-relaxed first:mt-0">
          <dt className="text-gold">{term}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
