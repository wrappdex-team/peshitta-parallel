import { NAME_HEBREW } from "@/lib/declaration";

/** Wax signet cut with the square letters of his century: ישוע. Not the older paleo-Hebrew. */
export function NameSeal({ className = "size-36" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} role="img" aria-label={`Seal of the name ${NAME_HEBREW}`}>
      <circle cx="80" cy="80" r="74" fill="#7a2e38" />
      <circle cx="80" cy="80" r="64" fill="none" stroke="#f3efe4" strokeWidth="1.25" />
      <circle cx="80" cy="80" r="56" fill="none" stroke="#8d6b32" strokeWidth="2.25" />
      <text
        x="80"
        y="82"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#f3efe4"
        fontFamily='"Noto Serif Hebrew", serif'
        fontWeight="600"
        fontSize="44"
        lang="he"
        direction="rtl"
      >
        {NAME_HEBREW}
      </text>
    </svg>
  );
}
