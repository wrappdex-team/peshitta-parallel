import { useEffect, useMemo, useRef, useState } from "react";
import { makeStill } from "./adapters/still.ts";
import { direct } from "./adapters/director.ts";
import { FREE_NOTE, provider, type ProviderId } from "./catalog.ts";
import { patchStudioPrefs, readStudioPrefs, scopeRef, scopeVerses } from "./prefs.ts";
import { ASPECTS, irreverent, stillPrompt, type Aspect } from "./prompt.ts";
import { ResultCard, type Output } from "./result.tsx";
import { STYLES, styleById } from "./styles.ts";
import { Engine, type PanelProps } from "./workspace.tsx";

const SEEDED: ProviderId[] = ["fal", "stability"];
const DIRECTOR_NAME: Partial<Record<ProviderId, string>> = { google: "Gemini", anthropic: "Claude", openai: "GPT", xai: "Grok", openrouter: "OpenRouter" };

export function StillPanel({ scope, keys, onConnect, onMade }: PanelProps) {
  const prefs = readStudioPrefs();
  const able = (Object.keys(keys) as ProviderId[]).filter((id) => provider(id).caps.still?.length);
  const directors = (Object.keys(keys) as ProviderId[]).filter((id) => provider(id).caps.director?.length);
  const [engine, setEngine] = useState<ProviderId | "">(able.includes(prefs.stillEngine as ProviderId) ? (prefs.stillEngine as ProviderId) : (able[0] ?? ""));
  const models = engine ? (provider(engine).caps.still ?? []) : [];
  const [model, setModel] = useState(models[0]?.id ?? "");
  const [styleId, setStyleId] = useState(styleById(prefs.style).id);
  const [aspect, setAspect] = useState<Aspect>(ASPECTS.includes(prefs.aspect as Aspect) ? (prefs.aspect as Aspect) : "4:5");
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState("");
  const style = styleById(styleId);
  const ref = scopeRef(scope);
  const verses = scopeVerses(scope);
  const drafted = useMemo(() => stillPrompt(ref, verses, style), [ref, verses, style]);
  const [prompt, setPrompt] = useState(drafted);
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [outputs, setOutputs] = useState<Output[]>([]);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show the remembered style once, without moving the page.
    const node = strip.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (strip.current && node) strip.current.scrollLeft = node.offsetLeft - strip.current.offsetLeft - 4;
  }, []);

  useEffect(() => {
    if (!edited) setPrompt(drafted);
  }, [drafted, edited]);
  useEffect(() => {
    if (engine && !models.some((m) => m.id === model)) setModel(models[0]?.id ?? "");
  }, [engine, models, model]);

  const remember = (patch: Record<string, unknown>) => patchStudioPrefs(patch);

  async function refine() {
    const id = directors[0];
    if (!id) return;
    setBusy(true);
    setStatus(`${provider(id).name} is refining the prompt…`);
    const out = await direct(id, keys[id] as string, "still", prompt);
    setBusy(false);
    if (!out.ok) return setStatus(out.error);
    setPrompt(out.text);
    setEdited(true);
    setStatus(`Refined by ${provider(id).name}. Edit it freely.`);
  }

  async function make() {
    if (!engine) return;
    if (irreverent(prompt)) return setStatus("Studio keeps sacred art reverent. Please describe the scene more gently.");
    setBusy(true);
    setStatus(`Painting with ${provider(engine).name}…`);
    const out = await makeStill({ id: engine, key: keys[engine] as string, model, prompt, aspect, count, seed: seed ? Number(seed) : undefined });
    setBusy(false);
    if (!out.ok) return setStatus(out.error);
    const modelLabel = models.find((m) => m.id === model)?.label ?? model;
    const made = out.images.map((image) => ({ kind: "still" as const, provider: provider(engine).name, model: modelLabel, ref, src: image.src, mime: image.mime, detail: style.name, prompt }));
    setOutputs(made);
    setStatus(made.length > 1 ? `${made.length} stills ready.` : "Still ready.");
    for (const item of made) onMade?.(item);
  }

  if (!able.length) return <Engine cap="still" keys={keys} onConnect={onConnect} />;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" data-studio-still="">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1 text-muted">
          With
          <select aria-label="Still provider" className="min-h-11 bg-transparent pr-1 text-ink" value={engine} onChange={(event) => { const next = event.target.value as ProviderId; setEngine(next); remember({ stillEngine: next }); }}>
            {able.map((id) => <option key={id} value={id}>{provider(id).name}</option>)}
          </select>
        </label>
        <select aria-label="Still model" className="min-h-11 bg-transparent text-ink" value={model} onChange={(event) => setModel(event.target.value)}>
          {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>

      <fieldset className="min-w-0">
        <legend className="text-xs tracking-widest text-gold">STYLE</legend>
        <div ref={strip} className="toolbar-scroll -mx-1 mt-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Century style">
          {STYLES.map((row) => (
            <button key={row.id} type="button" role="radio" aria-checked={row.id === styleId} onClick={() => { setStyleId(row.id); remember({ style: row.id }); }} className={`w-28 shrink-0 snap-start border p-1.5 text-left ${row.id === styleId ? "border-garnet" : "border-line"}`}>
              <span aria-hidden="true" className="flex h-10">
                {row.palette.map((color) => <span key={color} className="flex-1" style={{ background: color }} />)}
              </span>
              <span className="mt-1 block font-serif text-sm leading-tight">{row.name}</span>
              <span className="block text-[11px] leading-tight text-muted">{row.era}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div role="radiogroup" aria-label="Aspect" className="flex flex-wrap">
          {ASPECTS.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={a === aspect} onClick={() => { setAspect(a); remember({ aspect: a }); }} className={`min-h-11 px-2 ${a === aspect ? "text-garnet underline underline-offset-4" : "text-muted"}`}>{a}</button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-muted">
          Variations
          <select className="min-h-11 bg-transparent text-ink" value={count} onChange={(event) => setCount(Number(event.target.value))}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {SEEDED.includes(engine as ProviderId) && (
          <label className="flex items-center gap-1 text-muted">
            Seed
            <input inputMode="numeric" className="min-h-11 w-24 border border-line bg-raised px-2 text-ink" value={seed} onChange={(event) => setSeed(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="random" />
          </label>
        )}
      </div>

      <label className="grid gap-1">
        <span className="text-xs tracking-widest text-gold">PROMPT</span>
        <textarea rows={5} value={prompt} onChange={(event) => { setPrompt(event.target.value); setEdited(true); }} className="w-full whitespace-pre-wrap break-words border border-line bg-raised p-3 text-sm leading-relaxed text-ink" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !prompt.trim()} onClick={() => void make()} className="min-h-11 bg-garnet px-5 text-paper disabled:opacity-40">
          {busy ? "Working…" : count > 1 ? `Make ${count} stills` : "Make the still"}
        </button>
        {directors.length > 0 && (
          <button type="button" disabled={busy} onClick={() => void refine()} className="min-h-11 border border-garnet px-3 text-garnet disabled:opacity-40">Refine with {DIRECTOR_NAME[directors[0]]}</button>
        )}
        {edited && <button type="button" className="min-h-11 px-2 text-sm text-muted" onClick={() => { setEdited(false); setPrompt(drafted); }}>Reset prompt</button>}
      </div>
      {engine === "free" && <p className="text-xs leading-relaxed text-muted" data-studio-free="">{FREE_NOTE}</p>}
      {status && <p role="status" className="text-sm text-muted">{status}</p>}
      {outputs.length > 0 && (
        <div className={`grid gap-3 ${outputs.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {outputs.map((output, i) => <ResultCard key={i} output={output} />)}
        </div>
      )}
    </div>
  );
}
