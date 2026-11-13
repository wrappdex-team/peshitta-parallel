import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { APP_SHARE, shareCard } from "@/lib/share";

export function BookLinks({ onDone }: { onDone?: () => void }) {
  const [note, setNote] = useState("");

  async function share() {
    const result = await shareCard(APP_SHARE);
    if (result === "copied") setNote("Copied. The link will show the card.");
    else if (result === "failed") setNote("Could not share from this browser.");
    else setNote("");
  }

  return (
    <div className="mt-4 border-t border-line">
      <Link to="/guide" onClick={onDone} className="flex min-h-11 items-center text-garnet">
        More in the guide
      </Link>
      <Link to="/words" onClick={onDone} className="flex min-h-11 items-center text-garnet">
        Words of Y'shua
      </Link>
      <Link to="/saved" onClick={onDone} className="flex min-h-11 items-center text-garnet">
        Saved
      </Link>
      <Link to="/names" onClick={onDone} className="flex min-h-11 items-center text-garnet">
        Name index
      </Link>
      <Link to="/study" onClick={onDone} className="flex min-h-11 items-center text-garnet">
        About this Injeel
      </Link>
      <button type="button" className="flex min-h-11 items-center text-left text-garnet" onClick={() => void share()}>
        Share this Injeel
      </button>
      <Link to="/" onClick={onDone} className="flex min-h-11 items-center">
        Home
      </Link>
      {note ? <p className="pb-2 text-sm text-muted">{note}</p> : null}
    </div>
  );
}
