import { useEffect, useRef, useState } from "react";
import { makeShot, type FilmAspect } from "./adapters/film.ts";
import { FREE_NOTE, provider, type ProviderId } from "./catalog.ts";
import { patchStudioPrefs, readStudioPrefs, scopeRef, scopeVerses } from "./prefs.ts";
import { irreverent, labelFor, storyboard } from "./prompt.ts";
import { STYLES, styleById } from "./styles.ts";
import { Engine, type PanelProps } from "./workspace.tsx";

const ASPECTS: FilmAspect[] = ["16:9", "9:16", "1:1"];
const LENGTHS = [5, 8, 10];
type Take = { state: "idle" | "making" | "done" | "error"; src?: string; note?: string };

export function FilmPanel({ scope, keys, onConnect, onMade }: PanelProps) {
  const prefs = readStudioPrefs();
  const able = (Object.keys(keys) as ProviderId[]).filter((id) => provider(id).caps.film?.length);
  const [engine, setEngine] = useState<ProviderId | "">(able[0] ?? "");
  const model = engine ? provider(engine).caps.film?.[0] : undefined;
  const [styleId, setStyleId] = useState(styleById(prefs.style).id);
  const [aspect, setAspect] = useState<FilmAspect>("16:9");
  const [seconds, setSeconds] = useState(5);
  const style = styleById(styleId);
  const verses = scopeVerses(scope);
  const shots = storyboard(scope.bookName, scope.chapter, verses, style);
  const key = `${styleId}|${shots.map((shot) => shot.id).join(",")}`;
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [takes, setTakes] = useState<Record<string, Take>>({});
  const board = { prompts, takes };
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [play, setPlay] = useState({ at: 0, run: 0 });
  const stop = useRef(false);
  const done = shots.filter((shot) => board.takes[shot.id]?.state === "done");

  const setTake = (id: string, take: Take) => setTakes((current) => ({ ...current, [id]: take }));
  const setPrompt = (id: string, text: string) => setPrompts((current) => ({ ...current, [id]: text }));
  useEffect(() => {
    setPrompts({});
    setTakes({});
    setPlay({ at: 0, run: 0 });
  }, [key]);

  async function makeAll() {
    if (!engine || !model) return;
    stop.current = false;
    setBusy(true);
    for (const [i, shot] of shots.entries()) {
      if (stop.current) break;
      if (board.takes[shot.id]?.state === "done") continue;
      const text = board.prompts[shot.id] ?? shot.prompt;
      if (irreverent(text)) {
        setTake(shot.id, { state: "error", note: "Studio keeps sacred film reverent. Please describe this shot more gently." });
        continue;
      }
      setTake(shot.id, { state: "making" });
      setStatus(`Shot ${i + 1} of ${shots.length} with ${provider(engine).name}. Films take a few minutes…`);
      const out = await makeShot({ id: engine, key: keys[engine] as string, model: model.id, prompt: text, seconds, aspect });
      setTake(shot.id, out.ok ? { state: "done", src: out.src } : { state: "error", note: out.error });
      if (out.ok) onMade?.({ kind: "film", provider: provider(engine).name, model: model.label, ref: shot.ref, src: out.src, mime: out.mime, detail: `${style.id}-shot-${i + 1}`, prompt: text });
    }
    setBusy(false);
    setStatus(stop.current ? "Stopped. Finished shots are kept." : "Shots ready. Play the film below.");
  }

  if (!able.length) return <Engine cap="film" keys={keys} onConnect={onConnect} />;
  const select = "min-h-11 w-full min-w-0 max-w-full bg-transparent text-ink";
  const radio = (on: boolean) => `min-h-11 px-2 ${on ? "text-garnet underline underline-offset-4" : "text-muted"}`;
  const at = Math.min(play.at, Math.max(0, done.length - 1));
  const current = done[at];
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" data-studio-film="">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-x-3 text-sm text-muted">
        <label className="grid min-w-0">With<select aria-label="Film provider" disabled={busy} className={select} value={engine} onChange={(event) => setEngine(event.target.value as ProviderId)}>{able.map((id) => <option key={id} value={id}>{provider(id).name} · {provider(id).caps.film?.[0].label}</option>)}</select></label>
        <label className="grid min-w-0">Style<select aria-label="Film style" disabled={busy} className={select} value={styleId} onChange={(event) => { setStyleId(event.target.value); patchStudioPrefs({ style: event.target.value }); }}>{STYLES.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-sm">
        <div role="radiogroup" aria-label="Frame" className="flex">{ASPECTS.map((a) => <button key={a} type="button" role="radio" aria-checked={aspect === a} onClick={() => setAspect(a)} className={radio(aspect === a)}>{a}</button>)}</div>
        <div role="radiogroup" aria-label="Seconds per shot" className="flex">{LENGTHS.map((s) => <button key={s} type="button" role="radio" aria-checked={seconds === s} onClick={() => setSeconds(s)} className={radio(seconds === s)}>{s} s</button>)}</div>
      </div>
      <ol className="grid gap-3" aria-label="Storyboard">
        {shots.map((shot, i) => {
          const take = board.takes[shot.id];
          return (
            <li key={shot.id} className="border-l-2 border-gold/60 pl-3" data-studio-shot={take?.state ?? "idle"}>
              <p className="text-xs tracking-widest text-gold">SHOT {i + 1} · {shot.ref}</p>
              <textarea aria-label={`Shot ${i + 1} prompt`} rows={3} value={board.prompts[shot.id] ?? shot.prompt} onChange={(event) => setPrompt(shot.id, event.target.value)} disabled={busy} className="mt-1 w-full whitespace-pre-wrap border border-line bg-raised p-2 text-sm leading-relaxed text-ink" />
              {take?.state === "making" && <p className="text-xs text-muted">Making…</p>}
              {take?.state === "done" && <p className="text-xs text-muted">Ready.</p>}
              {take?.state === "error" && <p className="text-xs text-garnet">{take.note}</p>}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">{shots.length} shot{shots.length === 1 ? "" : "s"} × {engine === "free" ? "about 2" : seconds} s{engine === "free" ? ", at no charge." : `, billed by ${engine ? provider(engine).name : "your provider"} to your own account.`}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !shots.length || done.length === shots.length} onClick={() => void makeAll()} className="min-h-11 bg-garnet px-5 text-paper disabled:opacity-40">{busy ? "Working…" : done.length === shots.length ? "All shots made" : done.length ? "Make the remaining shots" : shots.length > 1 ? `Make ${shots.length} shots` : "Make the shot"}</button>
        {busy && <button type="button" onClick={() => { stop.current = true; setStatus("Stopping after this shot…"); }} className="min-h-11 border border-garnet px-3 text-garnet">Stop after this shot</button>}
      </div>
      {engine === "free" && <p className="text-xs leading-relaxed text-muted" data-studio-free="">{FREE_NOTE} Clips are about 2 seconds each.</p>}
      {status && <p role="status" className="text-sm text-muted">{status}</p>}
      {current?.id && board.takes[current.id]?.src && (
        <figure className="border border-line bg-raised" data-studio-output="film">
          <video key={`${current.id}-${play.run}`} src={board.takes[current.id].src} controls playsInline autoPlay={play.run > 0} onEnded={() => at + 1 < done.length && setPlay((p) => ({ at: at + 1, run: p.run + 1 }))} className="block w-full" data-studio-player={at + 1} />
          <figcaption className="px-3 py-2 text-xs leading-relaxed text-muted" data-studio-label="">{labelFor({ kind: "film", provider: engine ? provider(engine).name : "", model: model?.label ?? "", ref: scopeRef(scope) })}</figcaption>
          <div className="flex flex-wrap items-center border-t border-line px-1 text-sm">
            <span className="px-2 text-xs text-muted">Shot {at + 1} of {done.length}</span>
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => setPlay((p) => ({ at: 0, run: p.run + 1 }))}>Play from the start</button>
            <a href={board.takes[current.id].src} download={`injeel-${current.id}.mp4`} className="inline-flex min-h-11 items-center px-2 text-garnet">Download shot</a>
          </div>
        </figure>
      )}
    </div>
  );
}
