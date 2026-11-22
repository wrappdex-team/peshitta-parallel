import { Link } from "@tanstack/react-router";
import { Feather } from "lucide-react";

/** The one door into Studio: a feather and the words “AI Studio”, nothing else. */
export function StudioEntry({ where, onDone }: { where: "menu" | "home"; onDone?: () => void }) {
  return (
    <Link
      to="/studio"
      onClick={onDone}
      data-studio-entry={where}
      className={`inline-flex min-h-11 items-center gap-2 text-garnet ${where === "home" ? "mt-8" : ""}`}
    >
      <Feather className="size-4" aria-hidden="true" />
      AI Studio
    </Link>
  );
}
