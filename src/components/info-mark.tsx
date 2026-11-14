import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/modal";
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

function HelpSheet({ uid, id, onClose }: { uid: string; id: string; onClose: () => void }) {
  const tip = HELP[id];
  if (!tip) return null;
  const titleId = `${uid}-title`;
  return (
    <Modal label={tip.title} labelledBy={titleId} announce className="help-scrim fixed inset-0 z-50 flex" onClose={onClose}>
      <div id={`${uid}-note`} className="help-sheet" role="region" aria-label={tip.title} onClick={(event) => event.stopPropagation()}>
        <div className="help-sheet-bar">
          <h2 id={titleId} className="min-w-0 truncate font-serif text-lg">
            {tip.title}
          </h2>
          <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center text-sm text-garnet" data-modal-initial onClick={onClose}>
            Close
          </button>
        </div>
        <div className="help-sheet-body">
          <p className={tip.line.length > 180 ? "text-base leading-relaxed text-ink" : "text-sm leading-relaxed text-ink"}>{withSyriac(tip.line)}</p>
          <p className="mt-3">
            <Link to="/guide" hash={tip.section} className="inline-flex min-h-11 items-center text-sm text-garnet">
              More in the guide
            </Link>
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** A small information mark. One note open at a time. Hidden when Help is off. */
export function InfoMark({ id, place = "pop" }: { id: string; place?: "pop" | "flow"; align?: "start" | "end" }) {
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

  if (!tip || !on) return null;

  function toggle() {
    setOpen(openId === uid ? null : uid);
  }

  function shut() {
    setOpen(null);
    buttonRef.current?.focus();
  }

  return (
    <span id={uid} ref={rootRef} className={place === "pop" ? "info-mark relative inline-flex" : "info-mark contents"}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center"
        aria-expanded={open}
        aria-controls={open ? `${uid}-note` : undefined}
        aria-label={`About ${tip.title}`}
        onClick={toggle}
      >
        <span className="pointer-events-none flex size-4 items-center justify-center rounded-full border border-gold font-serif text-[10px] leading-none text-gold" aria-hidden>
          i
        </span>
      </button>
      {open && typeof document !== "undefined" ? createPortal(<HelpSheet uid={uid} id={id} onClose={shut} />, document.body) : null}
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