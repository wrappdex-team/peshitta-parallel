import { languageById, type LangId } from "@/lib/languages";
import { rootRoman, type WordStudy } from "@/lib/scripture";
import { COGNATES, sayGloss } from "@/lib/word-say";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Line = { id: string; label: string; text: string; speak: string; tts: string; face: string; dir: "ltr" | "rtl" };

function linesFor(study: WordStudy, langs: LangId[]): Line[] {
  const lines: Line[] = [];
  if (study.roman) {
    lines.push({
      id: "syr",
      label: "Classical Syriac",
      text: study.roman,
      speak: study.roman.replace(/'/g, ""),
      tts: "en-US",
      face: "font-serif",
      dir: "ltr",
    });
  }
  const rootKey = study.root.join("");
  const cognate = COGNATES[rootKey];
  for (const lang of langs) {
    const language = languageById(lang);
    if (lang === "aii") {
      lines.push({
        id: lang,
        label: language.label,
        text: study.word,
        speak: study.roman ? study.roman.replace(/'/g, "") : study.word,
        tts: "ar",
        face: "font-syriac text-2xl",
        dir: "rtl",
      });
      continue;
    }
    if (lang === "he" && cognate) {
      lines.push({
        id: lang,
        label: language.label,
        text: cognate.he,
        speak: cognate.he,
        tts: "he-IL",
        face: "font-hebrew text-xl",
        dir: "rtl",
      });
      continue;
    }
    if (lang === "ar" && cognate) {
      lines.push({
        id: lang,
        label: language.label,
        text: cognate.ar,
        speak: cognate.ar,
        tts: "ar-SA",
        face: "font-arab text-xl",
        dir: "rtl",
      });
      continue;
    }
    const said = study.gloss ? sayGloss(study.gloss, lang) : "";
    lines.push({
      id: lang,
      label: language.label,
      text: said,
      speak: said,
      tts: language.tts === "en" ? "en-US" : language.tts,
      face:
        lang === "he"
          ? "font-hebrew text-xl"
          : lang === "ar"
            ? "font-arab text-xl"
            : lang === "el"
              ? "font-greek"
              : lang === "ru"
                ? "font-cyr"
                : lang === "zh"
                  ? "font-han"
                  : lang === "ja"
                    ? "font-kana"
                    : "font-serif",
      dir: language.dir === "rtl" ? "rtl" : "ltr",
    });
  }
  if (cognate && !langs.includes("he")) {
    lines.push({
      id: "cognate-he",
      label: "Hebrew cognate",
      text: cognate.he,
      speak: cognate.he,
      tts: "he-IL",
      face: "font-hebrew text-xl",
      dir: "rtl",
    });
  }
  if (cognate && !langs.includes("ar")) {
    lines.push({
      id: "cognate-ar",
      label: "Arabic cognate",
      text: cognate.ar,
      speak: cognate.ar,
      tts: "ar-SA",
      face: "font-arab text-xl",
      dir: "rtl",
    });
  }
  return lines;
}

function speakLine(line: Line, rate: number) {
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth || !line.speak.trim()) {
      resolve();
      return;
    }
    const utter = new SpeechSynthesisUtterance(line.speak);
    utter.lang = line.tts;
    const android = /android/i.test(navigator.userAgent);
    if (!android) {
      const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith(line.tts.slice(0, 2).toLowerCase()));
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      }
    }
    utter.rate = rate;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    synth.speak(utter);
  });
}

export function WordStudySheet({
  study,
  langs,
  onPick,
}: {
  study: WordStudy;
  langs: LangId[];
  onPick: (surface: string) => void;
}) {
  const lines = linesFor(study, langs);
  const [busy, setBusy] = useState("");
  const run = useRef(0);
  const cognate = COGNATES[study.root.join("")];

  useEffect(() => {
    return () => {
      run.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, [study.word]);

  async function play(line: Line | "all") {
    const token = run.current + 1;
    run.current = token;
    window.speechSynthesis?.cancel();
    const queue = line === "all" ? lines.filter((item) => item.speak && !item.id.startsWith("cognate")) : [line];
    setBusy(line === "all" ? "all" : line.id);
    for (const item of queue) {
      if (run.current !== token) return;
      await speakLine(item, item.id === "syr" ? 0.72 : 0.9);
    }
    if (run.current === token) setBusy("");
  }

  const parts = [
    ...study.prefixes.map((part) => ({ ...part, role: "prefix" })),
    { sy: study.stem, gloss: study.gloss, role: "stem" },
    ...study.suffixes.map((part) => ({ ...part, role: "ending" })),
  ];

  return (
    <div>
      <p tabIndex={-1} data-modal-initial className="font-syriac text-4xl text-syriac" lang="syr" dir="rtl">
        {study.word}
      </p>
      {study.roman && <p className="mt-1 text-sm text-gold">{study.roman}</p>}
      <p className="mt-2 font-serif text-xl">{study.gloss || "No gloss is settled for this form."}</p>
      {study.via && <p className="mt-2 text-sm leading-relaxed text-muted">{study.via}</p>}
      {study.note && <p className="mt-2 text-sm leading-relaxed">{study.note}</p>}

      <p className="mt-5 text-xs tracking-widest text-gold">BUILD</p>
      <div className="mt-2 flex flex-wrap gap-2" dir="rtl">
        {parts.map((part, index) => (
          <div key={`${part.role}-${part.sy}-${index}`} className="rounded-md border border-line px-2 py-1 text-center">
            <span className="block font-syriac text-2xl text-syriac" lang="syr">
              {part.sy}
            </span>
            <span dir="ltr" className="block text-xs text-muted">
              {part.role === "stem" ? "stem" : part.role}
              {part.role !== "stem" && part.gloss ? ` · ${part.gloss}` : ""}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs tracking-widest text-gold">
        {study.rootKind === "triliteral" ? "TRILITERAL" : "CONSONANTS"}
      </p>
      {study.root.length > 0 ? (
        <p className="mt-2 font-syriac text-3xl text-syriac" lang="syr" dir="rtl">
          {study.root.join(" · ")}
          <span dir="ltr" className="ml-3 align-middle font-serif text-base text-gold">
            {rootRoman(study.root)}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">No root consonants to show.</p>
      )}
      <p className="mt-1 text-sm text-muted">{study.rootNote}</p>
      {cognate && (
        <p className="mt-1 text-sm text-muted">
          Semitic kin of this root: {cognate.gloss}. Hebrew {cognate.he}. Arabic {cognate.ar}.
        </p>
      )}

      {study.kin.length > 0 && (
        <>
          <p className="mt-5 text-xs tracking-widest text-gold">SAME ROOT IN THIS INJEEL</p>
          <div className="mt-2 flex flex-wrap gap-2" dir="rtl">
            {study.kin.map((item) => (
              <button
                key={item.word}
                type="button"
                onClick={() => onPick(item.word)}
                className="rounded-md border border-line px-2 py-1 text-center"
              >
                <span className="block font-syriac text-xl text-syriac" lang="syr">
                  {item.word}
                </span>
                <span dir="ltr" className="block max-w-36 text-xs text-muted">
                  {item.gloss || item.roman || "·"}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs tracking-widest text-gold">HEAR IT</p>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 text-garnet" onClick={() => play("all")}>
          <Play className="size-4" />
          {busy === "all" ? "Speaking" : "All open tongues"}
        </button>
      </div>
      <ul className="mt-1">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center gap-3 border-b border-line py-2">
            <button
              type="button"
              className="flex size-11 shrink-0 items-center justify-center text-garnet disabled:opacity-40"
              aria-label={`Say ${line.label}`}
              disabled={!line.speak}
              onClick={() => play(line)}
            >
              <Play className="size-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-gold">{line.label}</p>
              <p dir={line.dir} className={`truncate ${line.face}`}>
                {line.text || "No settled word in this tongue yet."}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Syriac is spoken from the romanization, slowly, because most devices have no Syriac voice. The other lines are the open reading languages. A cognate is how the same root is said in Hebrew or Arabic, not a second translation of the verse.
      </p>
    </div>
  );
}
