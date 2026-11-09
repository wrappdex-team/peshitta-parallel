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

export function Guide() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState(0);
  const [family, setFamily] = useState(FAMILIES[0].id);
  const [bread, setBread] = useState<Bread>(BREADS_FALLBACK);

  useEffect(() => {
    setBread(breadFor());
    setMode(readFlag(WELCOME_KEY) ? null : "welcome");
    setReady(true);
    function onOpen(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "steps") {
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
    setStep(0);
    setMode("steps");
  }

  function finishSteps() {
    writeFlag(GUIDE_KEY);
    setMode(null);
  }

  if (!ready) return null;

  const current = STEPS[step];

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
        <Modal label="Daily bread" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim px-4 pb-safe sm:items-center" onClose={dismissAll}>
          <Sheet>
            <p className="font-syriac text-2xl text-syriac" lang="syr" dir="rtl">
              ܐܘܢܓܠܝܘܢ
            </p>
            <p className="mt-3 text-xs tracking-widest text-gold">DAILY BREAD</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Come and see.</h2>
            <p className="mt-3 text-base leading-relaxed">
              The words of Y'shua, kept in the Syriac of the Peshitta. This is a desk. Open a book, hear a line, touch a word.
            </p>
            <blockquote className="mt-5 border-s-2 border-garnet ps-4">
              <p className="font-serif text-lg leading-snug">{bread.line}</p>
              <p className="mt-2 text-sm text-gold">{bread.from}</p>
            </blockquote>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button type="button" data-modal-initial className="min-h-11 bg-garnet px-4 text-paper" onClick={begin}>
                Begin the guide
              </button>
              <button type="button" className="min-h-11 border border-line px-4" onClick={dismissAll}>
                Not now
              </button>
            </div>
          </Sheet>
        </Modal>
      )}

      {mode === "steps" && current && (
        <Modal label="Guide" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim px-4 pb-safe sm:items-center" onClose={finishSteps}>
          <Sheet>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tracking-widest text-gold">
                {current.kicker.toUpperCase()} · {step + 1} OF {STEPS.length}
              </p>
              <button type="button" className="min-h-11 px-2 text-sm text-muted" onClick={finishSteps}>
                Hide
              </button>
            </div>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight">{current.title}</h2>
            <p className="mt-3 text-base leading-relaxed">{current.body}</p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="min-h-11 px-3 text-sm text-muted disabled:opacity-40"
                disabled={step === 0}
                onClick={() => setStep((n) => Math.max(0, n - 1))}
              >
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" data-modal-initial className="min-h-11 bg-garnet px-4 text-paper" onClick={() => setStep((n) => n + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" data-modal-initial className="min-h-11 bg-garnet px-4 text-paper" onClick={finishSteps}>
                  Begin reading
                </button>
              )}
            </div>
          </Sheet>
        </Modal>
      )}

      {mode === "panel" && (
        <Modal label="Guide" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim px-4 pb-safe sm:items-center" onClose={() => setMode(null)}>
          <Sheet>
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
              <button type="button" className="min-h-11 border border-line px-4 text-start" onClick={() => setMode("books")}>
                <span className="block font-serif text-lg text-ink">The books</span>
                <span className="block text-sm text-muted">Gospels, Acts, letters, the unveiling</span>
              </button>
              <button
                type="button"
                className="min-h-11 border border-line px-4 text-start"
                onClick={() => {
                  setStep(0);
                  setMode("steps");
                }}
              >
                <span className="block font-serif text-lg text-ink">Walk the guide again</span>
                <span className="block text-sm text-muted">Seven short steps, then it hides</span>
              </button>
            </div>
          </Sheet>
        </Modal>
      )}

      {mode === "books" && (
        <Modal label="The books" className="fixed inset-0 z-50 flex items-end justify-center bg-scrim px-4 pb-safe sm:items-center" onClose={() => setMode("panel")}>
          <Sheet>
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
                  <div key={item.id} className="border border-line">
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
                    {open && <p className="border-t border-line px-3 py-3 text-sm leading-relaxed">{item.body}</p>}
                  </div>
                );
              })}
            </div>
          </Sheet>
        </Modal>
      )}
    </>
  );
}

const BREADS_FALLBACK: Bread = {
  line: "In the beginning was the Word, and the Word was with Elohim, and Elohim was the Word.",
  from: "John 1:1",
};

function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-sheet w-full max-w-lg overflow-y-auto border border-line bg-paper px-5 py-6 text-ink sm:px-6">
      {children}
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
