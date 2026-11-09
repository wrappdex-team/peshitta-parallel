import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/modal";
import {
  FAMILIES,
  GUIDE_KEY,
  STEPS,
  WELCOME_KEY,
  breadFor,
  readFlag,
  writeFlag,
  type Bread,
} from "@/lib/guide";

type Mode = "welcome" | "steps" | "panel" | "books";
type Dir = "down" | "up";

const CENTER = "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgb(28_22_18/0.55)] px-4 py-6";

export function Guide() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<Dir>("down");
  const [family, setFamily] = useState(FAMILIES[0].id);
  const [bread, setBread] = useState<Bread>(BREADS_FALLBACK);

  useEffect(() => {
    setBread(breadFor());
    setMode(readFlag(WELCOME_KEY) ? null : "welcome");
    setReady(true);
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "steps") {
        setDir("down");
        setStep(0);
        setMode("steps");
      } else if (detail === "books") {
        setMode("books");
      } else {
        setMode("panel");
      }
    }
    window.addEventListener("injeel-guide", onOpen);
    return () => window.removeEventListener("injeel-guide", onOpen);
  }, []);

  function finishWelcome() {
    writeFlag(WELCOME_KEY);
  }

  function dismissAll() {
    finishWelcome();
    writeFlag(GUIDE_KEY);
    setMode(null);
  }

  function begin() {
    finishWelcome();
    setDir("down");
    setStep(0);
    setMode("steps");
  }

  function finishSteps() {
    writeFlag(GUIDE_KEY);
    setMode(null);
  }

  function go(next: number) {
    setDir(next > step ? "down" : "up");
    setStep(next);
  }

  if (!ready) return null;

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;

  return (
    <>
      {mode == null && (
        <button
          type="button"
          className="bottom-helper fixed end-4 z-30 flex size-11 items-center justify-center border border-line bg-raised text-ink"
          aria-label="Open the guide"
          onClick={() => setMode("panel")}
        >
          <ChevronMark className="size-7" />
        </button>
      )}

      {mode === "welcome" && (
        <Modal label="Daily bread" className={CENTER} onClose={dismissAll}>
          <Scroll
            leafKey="welcome"
            dir="down"
            bottom={{ label: "Unroll the guide", onClick: begin, initial: true }}
          >
            <p className="text-center font-syriac text-2xl text-syriac" lang="syr" dir="rtl">
              ܐܘܢܓܠܝܘܢ
            </p>
            <p className="mt-3 text-center text-xs tracking-widest text-gold">DAILY BREAD</p>
            <h2 className="mt-2 text-center font-serif text-3xl font-semibold tracking-tight">Come and see.</h2>
            <p className="mt-3 text-center text-base leading-relaxed">
              The words of Y'shua, kept in the Syriac of the Peshitta. This is a desk. Open a book, hear a line, touch a word.
            </p>
            <blockquote className="mt-5 border-s-2 border-garnet ps-4 text-start">
              <p className="font-serif text-lg leading-snug">{bread.line}</p>
              <p className="mt-2 text-sm text-gold">{bread.from}</p>
            </blockquote>
            <div className="mt-5 text-center">
              <button type="button" className="min-h-11 px-3 text-sm text-muted" onClick={dismissAll}>
                Not now
              </button>
            </div>
          </Scroll>
        </Modal>
      )}

      {mode === "steps" && current && (
        <Modal label="Guide" className={CENTER} onClose={finishSteps}>
          <Scroll
            leafKey={step}
            dir={dir}
            top={{ label: "Roll back", onClick: () => go(step - 1), disabled: step === 0 }}
            bottom={{
              label: last ? "Begin reading" : "Unroll",
              onClick: last ? finishSteps : () => go(step + 1),
              initial: true,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tracking-widest text-gold">
                {current.kicker.toUpperCase()} · {step + 1} OF {STEPS.length}
              </p>
              <button type="button" className="min-h-11 px-2 text-sm text-muted" onClick={finishSteps}>
                Hide
              </button>
            </div>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{current.title}</h2>
            <div className="mt-3 h-px w-16 bg-gold" />
            <p className="mt-3 text-base leading-relaxed" aria-live="polite">
              {current.body}
            </p>
            <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true">
              {STEPS.map((_, index) => (
                <span key={index} className={`h-px w-5 ${index <= step ? "bg-gold" : "bg-[#c9b48a]"}`} />
              ))}
            </div>
          </Scroll>
        </Modal>
      )}

      {mode === "panel" && (
        <Modal label="Guide" className={CENTER} onClose={() => setMode(null)}>
          <Scroll leafKey="panel" dir="down">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-widest text-gold">TODAY’S BREAD</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">The helper</h2>
              </div>
              <button type="button" data-modal-initial className="min-h-11 px-2 text-sm text-muted" onClick={() => setMode(null)}>
                Close
              </button>
            </div>
            <blockquote className="mt-4 border-s-2 border-garnet ps-4">
              <p className="font-serif text-lg leading-snug">{bread.line}</p>
              <p className="mt-2 text-sm text-gold">{bread.from}</p>
            </blockquote>
            <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted">
              <li>The Syriac is the text. A second tongue sits beside it.</li>
              <li>Touch a Syriac word to see its root and hear it.</li>
              <li>Lines in red are the words of Y'shua.</li>
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" className="min-h-11 border border-[#c9b48a] px-4 text-start" onClick={() => setMode("books")}>
                <span className="block font-serif text-lg text-ink">The books</span>
                <span className="block text-sm text-muted">Gospels, Acts, letters, the unveiling</span>
              </button>
              <button
                type="button"
                className="min-h-11 border border-[#c9b48a] px-4 text-start"
                onClick={() => {
                  setDir("down");
                  setStep(0);
                  setMode("steps");
                }}
              >
                <span className="block font-serif text-lg text-ink">Walk the guide again</span>
                <span className="block text-sm text-muted">Seven short steps. Unroll each one.</span>
              </button>
            </div>
          </Scroll>
        </Modal>
      )}

      {mode === "books" && (
        <Modal label="The books" className={CENTER} onClose={() => setMode("panel")}>
          <Scroll leafKey="books" dir="down">
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="min-h-11 px-1 text-sm text-garnet" onClick={() => setMode("panel")}>
                Back
              </button>
              <button type="button" data-modal-initial className="min-h-11 px-2 text-sm text-muted" onClick={() => setMode(null)}>
                Close
              </button>
            </div>
            <h2 className="font-serif text-2xl font-semibold">What you are opening</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              A teacher’s map, not a syllabus. Read the family that matches the book in your hand.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {FAMILIES.map((item) => {
                const open = family === item.id;
                return (
                  <div key={item.id} className="border border-[#c9b48a]">
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-start"
                      aria-expanded={open}
                      onClick={() => setFamily(item.id)}
                    >
                      <span>
                        <span className="block font-serif text-lg">{item.title}</span>
                        <span className="block text-sm text-gold">{item.books}</span>
                      </span>
                    </button>
                    {open && <p className="border-t border-[#c9b48a] px-3 py-3 text-sm leading-relaxed">{item.body}</p>}
                  </div>
                );
              })}
            </div>
          </Scroll>
        </Modal>
      )}
    </>
  );
}

const BREADS_FALLBACK: Bread = {
  line: "In the beginning was the Word, and the Word was with Elohim, and Elohim was the Word.",
  from: "John 1:1",
};

function Scroll({
  children,
  leafKey,
  dir,
  top,
  bottom,
}: {
  children: ReactNode;
  leafKey: string | number;
  dir: Dir;
  top?: { label: string; onClick: () => void; disabled?: boolean };
  bottom?: { label: string; onClick: () => void; initial?: boolean };
}) {
  return (
    <div className="scroll-stage" data-turn={dir}>
      {top ? (
        <button type="button" className="scroll-pull" disabled={top.disabled} aria-label={top.label} onClick={top.onClick}>
          <span className="scroll-pull-word">{top.label}</span>
          <span className="scroll-roller" aria-hidden="true" />
        </button>
      ) : (
        <div className="scroll-pull" aria-hidden="true">
          <span className="scroll-roller" />
        </div>
      )}
      <div className="scroll-parchment">
        <div key={leafKey} className="scroll-leaf" data-dir={dir}>
          {children}
        </div>
      </div>
      {bottom ? (
        <button
          type="button"
          className="scroll-pull"
          aria-label={bottom.label}
          data-modal-initial={bottom.initial ? true : undefined}
          onClick={bottom.onClick}
        >
          <span className="scroll-roller" aria-hidden="true" />
          <span className="scroll-pull-word">{bottom.label}</span>
        </button>
      ) : (
        <div className="scroll-pull" aria-hidden="true">
          <span className="scroll-roller" />
        </div>
      )}
    </div>
  );
}

function ChevronMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" className="fill-gold-soft" />
      {[2, 6, 10, 14, 18, 22, 26].map((y) => (
        <path
          key={y}
          d={`M1 ${y + 3.2} L5 ${y} L9 ${y + 3.2} L13 ${y} L17 ${y + 3.2} L21 ${y} L25 ${y + 3.2} L29 ${y} L31 ${y + 1.6}`}
          fill="none"
          className="text-ink"
          stroke="currentColor"
          strokeWidth="1.35"
        />
      ))}
    </svg>
  );
}