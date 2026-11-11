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

export function SyriacNames({ text, english }: { text: string; english?: string }) {
  let prev = "";
  return syriacPieces(text).map((piece, index) => {
    if (piece.kind === "space") return <span key={index}>{piece.text}</span>;
    const named = nameOfSyriac(piece.word, english, prev);
    prev = piece.word;
    if (!named) return <span key={index}>{piece.text}</span>;
    return (
      <Link key={index} to="/names" hash={named.id} className={`${NAME_CLASS} font-syriac`}>
        {piece.text}
      </Link>
    );
  });
}
