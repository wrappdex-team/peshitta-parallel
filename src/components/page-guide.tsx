import { Link } from "@tanstack/react-router";

/** A text link into the handbook. Not a sheet. */
export function PageGuide({ section, note }: { section: string; note: string }) {
  return (
    <p className="mt-3 text-sm leading-relaxed text-muted">
      <Link to="/guide" hash={section} className="text-garnet">
        Guide
      </Link>
      <span> · {note}</span>
    </p>
  );
}
