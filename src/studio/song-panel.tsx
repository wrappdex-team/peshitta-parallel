import { useEffect, useState } from "react";
import { direct } from "./adapters/director.ts";
import { makeSong } from "./adapters/song.ts";
import { FREE_NOTE, provider, type ProviderId } from "./catalog.ts";
import { patchStudioPrefs, readStudioPrefs, scopeRef, scopeVerses } from "./prefs.ts";
import { Advanced, CUSTOM_STYLE_ID, StyleSelect } from "./controls.tsx";
import { irreverent, lyricsFor, songPrompt, type SongLanguage, type SongShape } from "./prompt.ts";
import { ResultCard, type Output } from "./result.tsx";
import { Engine, type PanelProps } from "./workspace.tsx";

const GENRES = ["Syriac chant", "Byzantine chant", "Gregorian chant", "Hymn with organ", "Gospel choir", "Acoustic folk", "Orchestral", "Ambient", "Worship ballad", "Middle Eastern oud and frame drum"];
const MOODS = ["peaceful", "joyful", "solemn", "hopeful", "lamenting", "triumphant"];
const VOCALS = ["choir", "male", "female", "instrumental"];
const LENGTHS = [30, 60, 120, 180];
const LANGS: { id: SongLanguage; label: string }[] = [
  { id: "english", label: "English" },
  { id: "syriac", label: "Syriac" },
  { id: "both", label: "Both" },
];

export function SongPanel({ scope, keys, onConnect, onMade }: PanelProps) {
  const prefs = readStudioPrefs();
  const ids = Object.keys(keys) as ProviderId[];
  const singers = ids.filter((id) => provider(id).caps.song?.length);
  const reciters = ids.filter((id) => provider(id).caps.voice?.length);
  const able = [...singers, ...reciters.filter((id) => !singers.includes(id))];
  const directors = ids.filter((id) => provider(id).caps.director?.length);
  const [engine, setEngine] = useState<ProviderId | "">(able[0] ?? "");
  const recite = Boolean(engine) && !provider(engine as ProviderId).caps.song?.length;
  const models = engine ? (provider(engine).caps[recite ? "voice" : "song"] ?? []) : [];
  const [language, setLanguage] = useState<SongLanguage>((["english", "syriac", "both"] as const).includes(prefs.songLanguage as SongLanguage) ? (prefs.songLanguage as SongLanguage) : "english");
  const [shape, setShape] = useState<Omit<SongShape, "language">>({ genre: prefs.genre === CUSTOM_STYLE_ID || (typeof prefs.genre === "string" && GENRES.includes(prefs.genre)) ? String(prefs.genre) : GENRES[0], mood: "peaceful", bpm: 72, vocal: "choir", seconds: 60 });
  const [customGenre, setCustomGenre] = useState(typeof prefs.customGenre === "string" ? prefs.customGenre : "");
  const ref = scopeRef(scope);
  const verses = scopeVerses(scope);
  const drafted = lyricsFor(verses, language);
  const [lyrics, setLyrics] = useState(drafted);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const genreText = shape.genre === CUSTOM_STYLE_ID ? customGenre.trim() : shape.genre;
  const autoPrompt = songPrompt(ref, { ...shape, genre: genreText || "sacred music", language });
  const ready = Boolean(lyrics.trim() && (shape.genre !== CUSTOM_STYLE_ID || customGenre.trim()));

  useEffect(() => setLyrics(drafted), [drafted]);
  useEffect(() => setPrompt(""), [autoPrompt]);

  const update = (patch: Partial<typeof shape>) => {
    setShape((current) => ({ ...current, ...patch }));
    if (patch.genre) patchStudioPrefs({ genre: patch.genre });
  };
  const chooseGenre = (id: string, custom?: string) => {
    update({ genre: id });
    if (custom != null) {
      setCustomGenre(custom);
      patchStudioPrefs({ genre: id, customGenre: custom });
    }
  };

  async function refine() {
    const id = directors[0];
    if (!id) return;
    setBusy(true);
    setStatus(`${provider(id).name} is arranging…`);
    const out = await direct(id, keys[id] as string, "song", prompt || autoPrompt);
    setBusy(false);
    if (!out.ok) return setStatus(out.error);
    setPrompt(out.text);
    setStatus(`Arranged by ${provider(id).name}. The lyrics stay as scripture.`);
  }

  async function make() {
    if (!engine || !ready) return;
    const finalPrompt = prompt || autoPrompt;
    if (irreverent(finalPrompt)) return setStatus("Studio keeps sacred music reverent. Please describe it more gently.");
    setBusy(true);
    setOutput(null);
    setStatus(recite ? `Recording a recitation with ${provider(engine).name}…` : `Composing with ${provider(engine).name}. Songs can take a minute or two…`);
    const out = await makeSong({ id: engine, key: keys[engine] as string, model: models[0]?.id ?? "", prompt: finalPrompt, lyrics, seconds: shape.seconds, instrumental: shape.vocal === "instrumental" }, fetch, undefined, (n) => setStatus(`Still composing… (${(n + 1) * 4} s)`));
    setBusy(false);
    if (!out.ok) return setStatus(out.error);
    const made: Output = { kind: recite ? "voice" : "song", provider: provider(engine).name, model: models[0]?.label ?? "", ref, src: out.src, mime: out.mime, detail: recite ? "recitation" : (genreText || "Custom style"), prompt: finalPrompt };
    setOutput(made);
    setStatus(recite ? "Recitation ready." : "Song ready.");
    onMade?.(made);
  }

  if (!able.length) return <Engine cap="song" keys={keys} onConnect={onConnect} />;
  const select = "min-h-11 w-full min-w-0 max-w-full bg-transparent text-ink";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" data-studio-song="">
      <label className="flex flex-wrap items-center gap-1 text-sm text-muted">
        With
        <select aria-label="Song provider" className={`${select} w-auto pr-1`} value={engine} onChange={(event) => setEngine(event.target.value as ProviderId)}>
          {able.map((id) => <option key={id} value={id}>{provider(id).name}{singers.includes(id) ? "" : " (recite)"}</option>)}
        </select>
        <span>· {models[0]?.label}</span>
      </label>
      {!recite && <StyleSelect label="Style" value={shape.genre} options={GENRES.map((g) => ({ id: g, label: g }))} custom={customGenre} onChange={chooseGenre} />}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !ready} onClick={() => void make()} className="min-h-11 bg-garnet px-5 text-paper disabled:opacity-40">{busy ? "Working…" : recite ? "Make the recitation" : "Make the song"}</button>
      </div>
      <Advanced>
        <div role="radiogroup" aria-label="Language" className="flex flex-wrap text-sm">
          {LANGS.map((row) => (
            <button key={row.id} type="button" role="radio" aria-checked={language === row.id} onClick={() => { setLanguage(row.id); patchStudioPrefs({ songLanguage: row.id }); }} className={`min-h-11 px-2 ${language === row.id ? "text-garnet underline underline-offset-4" : "text-muted"}`}>{row.label}</button>
          ))}
        </div>
        {!recite && (
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-3 gap-y-1 text-sm text-muted">
            <label className="grid min-w-0">Mood<select className={select} value={shape.mood} onChange={(event) => update({ mood: event.target.value })}>{MOODS.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="grid min-w-0">Voice<select className={select} value={shape.vocal} onChange={(event) => update({ vocal: event.target.value })}>{VOCALS.map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="grid min-w-0">Tempo · {shape.bpm} BPM<input type="range" min={48} max={140} step={2} value={shape.bpm} onChange={(event) => update({ bpm: Number(event.target.value) })} className="min-h-11 w-full min-w-0 accent-garnet" /></label>
            <label className="grid min-w-0">Length<select className={select} value={shape.seconds} onChange={(event) => update({ seconds: Number(event.target.value) })}>{LENGTHS.map((s) => <option key={s} value={s}>{s < 60 ? `${s} s` : `${s / 60} min`}</option>)}</select></label>
          </div>
        )}
        <label className="grid gap-1">
          <span className="text-xs tracking-widest text-gold">LYRICS · SCRIPTURE</span>
          <textarea rows={4} value={lyrics} onChange={(event) => setLyrics(event.target.value)} dir="auto" style={{ fontFamily: '"Newsreader", "Noto Sans Syriac", "Palatino Linotype", Palatino, serif' }} className="w-full whitespace-pre-wrap border border-line bg-raised p-3 leading-relaxed text-ink" />
        </label>
        {!recite && (
          <label className="grid gap-1">
            <span className="text-xs tracking-widest text-gold">MUSIC PROMPT</span>
            <textarea rows={3} value={prompt || autoPrompt} onChange={(event) => setPrompt(event.target.value)} className="w-full whitespace-pre-wrap border border-line bg-raised p-3 text-sm leading-relaxed text-ink" />
          </label>
        )}
        {!recite && directors.length > 0 && <button type="button" disabled={busy} onClick={() => void refine()} className="min-h-11 border border-garnet px-3 text-garnet disabled:opacity-40">Arrange with {provider(directors[0]).name.split(" ").pop()}</button>}
      </Advanced>
      {language !== "english" && <p className="text-xs text-muted">Models may not pronounce Classical Syriac correctly. The words are given exactly as written.</p>}
      {engine === "free" && <p className="text-xs leading-relaxed text-muted" data-studio-free="">{FREE_NOTE}</p>}
      {status && <p role="status" className="text-sm text-muted">{status}</p>}
      {output && <ResultCard output={output} />}
    </div>
  );
}
