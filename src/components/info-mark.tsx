import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HELP } from "@/lib/help";
import { readHelp, setHelpMode, subscribeHelp } from "@/lib/help-state";
import { placeNote } from "@/lib/note-place";

let openId: string | null = null;
const openListeners = new Set<() => void>();

function setOpen(id: string | null) {
  openId = id;
  for (const listener of openListeners) listener();
}

function useHelpOn() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const apply = () => setOn(readHelp().mode === "on");
    apply();
    return subscribeHelp(apply);
  }, []);
  return on;
}

function withSyriac(text: string) {
  return text.split(/([\u0700-\u074F]+)/).map((part, index) =>
    /[\u0700-\u074F]/.test(part) ? (
      <span key={index} className="font-syriac" lang="syr" dir="rtl">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function NoteBody({ id }: { id: string }) {
  const tip = HELP[id];
  if (!tip) return null;
  const long = tip.line.length > 180;
  return (
    <div className="border border-line bg-paper p-3 text-left">
      <p className="font-serif text-lg text-ink">{tip.title}</p>
      <p className={long ? "mt-2 text-base leading-relaxed text-ink" : "mt-2 text-sm leading-relaxed text-ink"}>{withSyriac(tip.line)}</p>
      <p className="mt-3">
        <Link to="/guide" hash={tip.section} className="inline-flex min-h-11 items-center text-sm text-garnet">
          More in the guide
        </Link>
      </p>
    </div>
  );
}

function PopNote({
  uid,
  id,
  anchorRef,
  align,
  onClose,
}: {
  uid: string;
  id: string;
  anchorRef: { current: HTMLElement | null };
  align: "start" | "end";
  onClose: () => void;
}) {
  const [frame, setFrame] = useState<ReturnType<typeof placeNote> | null>(null);

  useEffect(() => {
    function place() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      setFrame(placeNote(anchor.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, align));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, align]);

  if (!frame || typeof document === "undefined") return null;

  const style = frame.narrow
    ? {
        position: "fixed" as const,
        left: frame.left,
        width: frame.width,
        bottom: "calc(8.25rem + env(safe-area-inset-bottom, 0px))",
        maxHeight: "calc(100dvh - 10rem - env(safe-area-inset-bottom, 0px))",
        overflowY: "auto" as const,
        zIndex: 50,
      }
    : {
        position: "fixed" as const,
        left: frame.left,
        top: frame.top ?? 16,
        width: frame.width,
        maxHeight: `calc(100dvh - ${(frame.top ?? 16) + 16}px)`,
        overflowY: "auto" as const,
        zIndex: 50,
      };

  return createPortal(
    <div id={`${uid}-note`} role="region" aria-label={HELP[id]?.title} style={style}>
      <NoteBody id={id} />
      <button type="button" className="mt-1 min-h-11 text-sm text-garnet" onClick={onClose}>
        Close
      </button>
    </div>,
    document.body,
  );
}

/** A small information mark. One note open at a time. Hidden when Help is off. */
export function InfoMark({ id, place = "pop", align = "start" }: { id: string; place?: "pop" | "flow"; align?: "start" | "end" }) {
  const uid = useId();
  const tip = HELP[id];
  const on = useHelpOn();
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
      if (event.key === "Escape") shut();
    }
    function onPointer(event: PointerEvent) {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (rootRef.current?.contains(node)) return;
      if (document.getElementById(`${uid}-note`)?.contains(node)) return;
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

  function shut() {
    setOpen(null);
    buttonRef.current?.focus();
  }

  const panel =
    open && place === "pop" ? (
      <PopNote uid={uid} id={id} anchorRef={rootRef} align={align} onClose={shut} />
    ) : open ? (
      <div id={`${uid}-note`} role="region" aria-label={tip.title} className="mt-2 max-w-full">
        <NoteBody id={id} />
        <button type="button" className="mt-1 min-h-11 text-sm text-garnet" onClick={shut}>
          Close
        </button>
      </div>
    ) : null;

  return (
    <span id={uid} ref={rootRef} className={place === "pop" ? "info-mark relative inline-flex" : "contents"}>
      <button
        ref={buttonRef}
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
      {place === "flow" && open ? (
        <div id={`${uid}-note`} role="region" aria-label={tip.title} className="w-full basis-full pt-2">
          <NoteBody id={id} />
          <button type="button" className="mt-1 min-h-11 text-sm text-garnet" onClick={shut}>
            Close
          </button>
        </div>
      ) : (
        panel
      )}
    </span>
  );
}

export function HelpSwitch() {
  const on = useHelpOn();
  return (
    <div className="border-b border-line">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between text-left"
        aria-pressed={on}
        onClick={() => setHelpMode(on ? "off" : "on")}
      >
        <span>Help</span>
        <span className="text-sm text-muted">{on ? "On" : "Off"}</span>
      </button>
      <Link to="/guide" className="flex min-h-11 items-center text-sm text-garnet">
        More in the guide
      </Link>
    </div>
  );
}
