import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { LANGS, languageFromPhone, type LangId } from "@/lib/languages";
import { subscribeReadingIntro, usePrefs, type Face } from "@/lib/use-prefs";

const COPY =
  "INjeel sets the Syriac Aramaic of the Peshitta beside a reading in your language. Choose how you would like to read. You can change this any time under Reading.";

function htmlLang(id: LangId) {
  return id === "aii" ? "syr" : id;
}

function Choice({
  name,
  checked,
  onChange,
  label,
  lang,
  dir,
  initial,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  lang?: string;
  dir?: "ltr" | "rtl";
  initial?: boolean;
}) {
  return (
    <label className="relative flex min-h-11 min-w-0 items-center gap-2 px-2">
      <input
        type="radio"
        name={name}
        className="first-run-choice absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
        checked={checked}
        data-modal-initial={initial ? true : undefined}
        onChange={onChange}
      />
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center border text-sm leading-none ${checked ? "border-garnet bg-garnet text-paper" : "border-line bg-paper text-transparent"}`}
      >
        ✓
      </span>
      <span className="min-w-0 break-words text-sm leading-tight" lang={lang} dir={dir}>
        {label}
      </span>
    </label>
  );
}

/** First visit, and again from Books or Reading. The card stays until the visitor answers. */
export function FirstRunIntro() {
  const { prefs, patch, ready, introduced } = usePrefs();
  const [manual, setManual] = useState(false);
  const [face, setFace] = useState<Face>("tr");
  const [lang, setLang] = useState<LangId>("en");
  const open = ready && (manual || !introduced);

  useEffect(() => subscribeReadingIntro(() => setManual(true)), []);

  useEffect(() => {
    if (!open) return;
    if (manual && introduced) {
      setFace(prefs.face === "both" ? "both" : "tr");
      setLang(prefs.lang);
      return;
    }
    setFace("tr");
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    setLang(languageFromPhone(tags));
  }, [open, manual, introduced, prefs.face, prefs.lang]);

  useEffect(() => {
    if (!open) return;
    return () => {
      if (document.querySelector("dialog[open]")) return;
      const main = document.querySelector("main");
      if (!(main instanceof HTMLElement)) return;
      if (!main.hasAttribute("tabindex")) main.tabIndex = -1;
      main.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  function start() {
    patch({ face, lang, intro: 1 });
    setManual(false);
  }

  function quick() {
    patch({ face: "tr", lang: "en", intro: 1 });
    setManual(false);
  }

  /** A reopened card must not rewrite a saved reading. First visit still takes Quick start. */
  function dismiss() {
    if (manual && introduced) {
      setManual(false);
      return;
    }
    quick();
  }

  const reopened = manual && introduced;

  return (
    <Modal
      label="How would you like to read?"
      announce
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-scrim p-2"
      onClose={dismiss}
    >
      <div
        data-first-run-card
        className="first-run-card flex w-full min-w-0 max-w-[28rem] flex-col overflow-hidden border border-line bg-paper font-serif text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="first-run-top shrink-0 px-4 pt-4">
          <h2 className="text-xl leading-tight">How would you like to read?</h2>
          <p className="mt-2 text-base leading-snug">{COPY}</p>
          <fieldset className="mt-3 min-w-0">
            <legend className="text-xs tracking-widest text-gold">PAGE</legend>
            <div className="mt-1" role="radiogroup" aria-label="Page">
              <Choice
                name="read-face"
                checked={face === "both"}
                onChange={() => setFace("both")}
                label="Syriac side by side"
                initial={face === "both"}
              />
              <Choice
                name="read-face"
                checked={face === "tr"}
                onChange={() => setFace("tr")}
                label="One language only"
                initial={face === "tr"}
              />
            </div>
          </fieldset>
        </div>
        <div className="first-run-langs-wrap min-h-0 px-4 pb-2">
          <fieldset className="min-w-0">
            <legend className="text-xs tracking-widest text-gold">LANGUAGE</legend>
            <div className="first-run-langs mt-1" role="radiogroup" aria-label="Language">
              {LANGS.map((item) => (
                <Choice
                  key={item.id}
                  name="read-lang"
                  checked={lang === item.id}
                  onChange={() => setLang(item.id)}
                  label={item.label}
                  lang={htmlLang(item.id)}
                  dir={item.dir}
                />
              ))}
            </div>
          </fieldset>
        </div>
        <div className="first-run-footer flex min-w-0 flex-col gap-2 border-t border-line bg-paper px-4 py-2">
          <div className="flex min-w-0 items-stretch gap-2">
            {reopened ? (
              <button type="button" className="min-h-11 shrink-0 border border-line bg-paper px-3 text-ink" onClick={dismiss}>
                Cancel
              </button>
            ) : null}
            <button type="button" className="min-h-11 min-w-0 flex-1 whitespace-normal bg-garnet px-3 text-paper" onClick={start}>
              Start reading
            </button>
          </div>
          <button type="button" className="min-h-11 w-full whitespace-normal border border-line px-3 text-ink" onClick={quick}>
            Quick start (English)
          </button>
        </div>
      </div>
    </Modal>
  );
}
