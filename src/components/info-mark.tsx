import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { HELP } from "@/lib/help";
import { readHelp, setHelpMode, subscribeHelp } from "@/lib/help-state";

let openId: string | null = null;
const openListeners = new Set<() => void>();

function setOpen(id: string | null) {
  openId = id;
  for (const listener of openListeners) listener();
}

function useHelpOn() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(readHelp().mode === "on");
    return subscribeHelp(() => setOn(readHelp().mode === "on"));
  }, []);
  return on;
}

function NoteBody({ id }: { id: string }) {
  const tip = HELP[id];
  if (!tip) return null;
  return (
    <div className="border border-line bg-paper p-3 text-left">
      <p className="font-serif text-lg text-ink">{tip.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{tip.line}</p>
      <p className="mt-3">
        <Link to="/guide" hash={tip.section} className="inline-flex min-h-11 items-center text-sm text-garnet">
          Notes
        </Link>
      </p>
    </div>
  );
}

/** A small information mark. One note open at a time. Hidden when Help is off. */
export function InfoMark({ id, place = "pop", align = "start" }: { id: string; place?: "pop" | "flow"; align?: "start" | "end" }) {
  const uid = useId();
  const tip = HELP[id];
  const on = useHelpOn();
  const [open, setLocal] = useState(false);

  useEffect(() => {
    const pull = () => setLocal(openId === uid);
    openListeners.add(pull);
    return () => {
      openListeners.delete(pull);
      if (openId === uid) openId = null;
    };
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    function onPointer(event: PointerEvent) {
      const node = event.target;
      if (node instanceof Node && document.getElementById(uid)?.contains(node)) return;
      setOpen(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, uid]);

  if (!tip || !on) return null;

  function toggle() {
    setOpen(openId === uid ? null : uid);
  }

  const panel = open ? (
    <div id={`${uid}-note`} className={place === "pop" ? `absolute top-full z-50 mt-1 w-72 max-w-[min(18rem,calc(100vw-2.5rem))] ${align === "end" ? "end-0" : "start-0"}` : "mt-2 max-w-xl"}>
      <NoteBody id={id} />
      <button type="button" className="mt-1 min-h-11 text-sm text-garnet" onClick={() => setOpen(null)}>
        Close
      </button>
    </div>
  ) : null;

  return (
    <span id={uid} className={place === "pop" ? "relative inline-flex" : "relative block"}>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center"
        aria-expanded={open}
        aria-controls={open ? `${uid}-note` : undefined}
        aria-label={`About ${tip.title}`}
        onClick={toggle}
      >
        <span className="flex size-4 items-center justify-center rounded-full border border-gold font-serif text-[10px] leading-none text-gold" aria-hidden>
          i
        </span>
      </button>
      {panel}
    </span>
  );
}

export function HelpSwitch() {
  const on = useHelpOn();
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center justify-between border-b border-line text-left"
      aria-pressed={on}
      onClick={() => setHelpMode(on ? "off" : "on")}
    >
      <span>Help</span>
      <span className="text-sm text-muted">{on ? "On" : "Off"}</span>
    </button>
  );
}
