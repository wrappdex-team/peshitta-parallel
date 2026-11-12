import { rangeHits } from "@/lib/jesus";
import { Link } from "@tanstack/react-router";
import { NAME_CLASS, nameOfSyriac, nameRuns } from "@/lib/names";
import { syriacPieces } from "@/lib/scripture";

export function NameText({ text }: { text: string }) {
  return nameRuns(text).map((part, index) =>
    part.kind === "name" ? (
      <Link key={index} to="/names" hash={part.id} className={NAME_CLASS}>
        {part.text}
      </Link>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

export function SyriacNames({ text, english, ranges }: { text: string; english?: string; ranges?: [number, number][] | null }) {
  let prev = "";
  let offset = 0;
  return syriacPieces(text).map((piece, index) => {
    const start = offset;
    offset += piece.text.length;
    const hot = rangeHits(ranges, start, offset);
    if (piece.kind === "space") return <span key={index} className={hot ? "text-jesus" : undefined}>{piece.text}</span>;
    const named = nameOfSyriac(piece.word, english, prev);
    prev = piece.word;
    const color = hot ? "text-jesus" : "";
    if (!named) return <span key={index} className={color}>{piece.text}</span>;
    return (
      <Link key={index} to="/names" hash={named.id} className={`${NAME_CLASS} font-syriac ${color}`}>
        {piece.text}
      </Link>
    );
  });
}
