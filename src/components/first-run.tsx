import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { LANGS, languageFromPhone, type LangId } from "@/lib/languages";
import { subscribeReadingIntro, usePrefs, type Face } from "@/lib/use-prefs";

const COPY =
  "INjeel sets the Syriac Aramaic of the Peshitta beside a reading in your language. Choose how you would like to read. You can change this any time under Reading.";

function htmlLang(id: LangId) {
  return id === "aii" ? "syr" : id;
}

/** First visit, and again from Books or Reading. Nothing is stored until the visitor answers. */
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

  return (
    <Modal
      label="How would you like to read?"
      announce
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-scrim"
      onClose={quick}
    >
      <div
        className="my-auto max-h-full w-full min-w-0 max-w-md overflow-y-auto border border-line bg-paper px-4 py-5 font-serif text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-2xl leading-tight">How would you like to read?</h2>
        <p className="mt-3 text-base leading-relaxed">{COPY}</p>
        <fieldset className="mt-5 min-w-0">
          <legend className="text-xs tracking-widest text-gold">PAGE</legend>
          <div className="mt-1" role="radiogroup" aria-label="Page">
            <label className="flex min-h-11 w-full min-w-0 items-center gap-3">
              <input
                type="radio"
                name="read-face"
                className="size-11 shrink-0"
                checked={face === "both"}
                data-modal-initial={face === "both" ? true : undefined}
                onChange={() => setFace("both")}
              />
              <span className="min-w-0 break-words">Syriac side by side</span>
            </label>
            <label className="flex min-h-11 w-full min-w-0 items-center gap-3">
              <input
                type="radio"
                name="read-face"
                className="size-11 shrink-0"
                checked={face === "tr"}
                data-modal-initial={face === "tr" ? true : undefined}
                onChange={() => setFace("tr")}
              />
              <span className="min-w-0 break-words">One language only</span>
            </label>
          </div>
        </fieldset>
        <fieldset className="mt-4 min-w-0">
          <legend className="text-xs tracking-widest text-gold">LANGUAGE</legend>
          <div className="mt-1" role="radiogroup" aria-label="Language">
            {LANGS.map((item) => (
              <label key={item.id} className="flex min-h-11 w-full min-w-0 items-center gap-3">
                <input
                  type="radio"
                  name="read-lang"
                  className="size-11 shrink-0"
                  checked={lang === item.id}
                  onChange={() => setLang(item.id)}
                />
                <span className="min-w-0 break-words" lang={htmlLang(item.id)} dir={item.dir}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex min-w-0 flex-col gap-2">
          <button type="button" className="min-h-11 w-full whitespace-normal bg-garnet px-3 text-paper" onClick={start}>
            Start reading
          </button>
          <button type="button" className="min-h-11 w-full whitespace-normal border border-line px-3 text-ink" onClick={quick}>
            Quick start (English)
          </button>
        </div>
      </div>
    </Modal>
  );
}
