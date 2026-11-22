import { useState } from "react";
import { complete } from "./adapters/director.ts";
import { provider, type ProviderId } from "./catalog.ts";
import { Advanced, CUSTOM_STYLE_ID, StyleSelect } from "./controls.tsx";
import { loadBook } from "@/lib/scripture";
import { patchStudioPrefs, readStudioPrefs, scopeRef, scopeVerses } from "./prefs.ts";
import { labelFor } from "./prompt.ts";
import { applyCitations, findCitations, LENGTHS, SERMON_SYSTEM, shareOrCopy, sermonUser, TONES, type SermonLength } from "./sermon.ts";

import type { PanelProps } from "./workspace.tsx";

export function SermonPanel({ scope, keys, onConnect }: PanelProps) {
  const prefs = readStudioPrefs();
  const able = (Object.keys(keys) as ProviderId[]).filter((id) => provider(id).caps.director?.length);
  const [engine, setEngine] = useState<ProviderId | "">(able.includes(prefs.sermonEngine as ProviderId) ? (prefs.sermonEngine as ProviderId) : (able[0] ?? ""));
  const model = engine ? provider(engine).caps.director?.[0] : undefined;
  const [toneId, setToneId] = useState(prefs.sermonTone === CUSTOM_STYLE_ID || (typeof prefs.sermonTone === "string" && (TONES as readonly string[]).includes(prefs.sermonTone)) ? String(prefs.sermonTone) : "Apologetic");
  const [customTone, setCustomTone] = useState(typeof prefs.customSermon === "string" ? prefs.customSermon : "");
  const [length, setLength] = useState<SermonLength>(LENGTHS.some((row) => row.id === prefs.sermonLength) ? (prefs.sermonLength as SermonLength) : "medium");
  const [guidance, setGuidance] = useState(typeof prefs.sermonGuidance === "string" ? prefs.sermonGuidance : "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [sermon, setSermon] = useState("");
  const [meta, setMeta] = useState<{ provider: string; model: string; ref: string } | null>(null);
  const ref = scopeRef(scope);
  const verses = scopeVerses(scope);
  const tone = toneId === CUSTOM_STYLE_ID ? customTone.trim() : toneId;
  const ready = Boolean(engine && (toneId !== CUSTOM_STYLE_ID || customTone.trim()));
  const label = meta ? labelFor({ kind: "sermon", provider: meta.provider, model: meta.model, ref: meta.ref }) : "";

  function remember(patch: Record<string, unknown>) {
    patchStudioPrefs(patch);
  }

  async function quotesFor(text: string) {
    const quotes: Record<string, string> = {};
    const needed = findCitations(text).filter((cite) => cite.ok && cite.book && cite.chapter && cite.from && cite.to);
    const ids = [...new Set(needed.map((cite) => cite.book!))];
    const books = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await loadBook(id)] as const)));
    for (const cite of needed) {
      const chapter = books[cite.book!]?.chapters[cite.chapter! - 1] ?? [];
      const parts: string[] = [];
      for (let v = cite.from!; v <= cite.to!; v++) {
        const row = chapter.find((verse) => verse.v === v);
        if (row?.en) parts.push(row.en);
      }
      if (parts.length) quotes[cite.display] = parts.join(" ");
    }
    return quotes;
  }

  async function make() {
    if (!engine || !ready || !model) return;
    setBusy(true);
    setStatus(`Writing with ${provider(engine).name}…`);
    const user = sermonUser(ref, verses, tone, length, guidance);
    const out = await complete(engine, keys[engine] as string, SERMON_SYSTEM, user, { maxTokens: 2500, maxChars: 12000 });
    if (!out.ok) {
      setBusy(false);
      return setStatus(out.error);
    }
    const checked = applyCitations(out.text, await quotesFor(out.text));
    setSermon(checked.text);
    setMeta({ provider: provider(engine).name, model: model.label, ref });
    setBusy(false);
    setStatus(checked.flags.length ? `${checked.flags.length === 1 ? "One citation was" : `${checked.flags.length} citations were`} flagged because ${checked.flags.length === 1 ? "it is" : "they are"} not in this New Testament edition.` : "Sermon ready. Edit it freely, then copy or share.");
  }

  async function copyText() {
    const result = await shareOrCopy(ref, sermon, { copy: (text) => navigator.clipboard.writeText(text) });
    setStatus(result === "copied" ? "Copied." : "Copy did not work. Select the text and copy it yourself.");
  }

  async function shareText() {
    const payload = `${ref}\n\n${sermon}${label ? `\n\n${label}` : ""}`;
    const result = await shareOrCopy(ref, payload, {
      share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
      copy: (text) => navigator.clipboard.writeText(text),
    });
    setStatus(result === "shared" ? "Shared." : result === "copied" ? "This browser cannot share. Copied to the clipboard." : result === "closed" ? "" : "Share did not work. Copy the text instead.");
  }

  if (!able.length) {
    return (
      <p className="text-sm text-muted">
        None of your connections writes a sermon yet. Connect Claude, Gemini, OpenAI, Grok or OpenRouter.{" "}
        <button type="button" className="min-h-11 text-garnet underline" onClick={onConnect}>Connect one</button>
      </p>
    );
  }

  const select = "min-h-11 bg-transparent text-ink";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4" data-studio-sermon="">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1 text-muted">
          With
          <select aria-label="Sermon provider" className={`${select} pr-1`} value={engine} onChange={(event) => { const next = event.target.value as ProviderId; setEngine(next); remember({ sermonEngine: next }); }}>
            {able.map((id) => <option key={id} value={id}>{provider(id).name}</option>)}
          </select>
        </label>
        <span className="text-muted">· {model?.label}</span>
      </div>
      <StyleSelect label="Tone" value={toneId} options={TONES.map((row) => ({ id: row, label: row }))} custom={customTone} onChange={(id, custom) => { setToneId(id); if (custom != null) { setCustomTone(custom); remember({ sermonTone: id, customSermon: custom }); } else remember({ sermonTone: id }); }} />
      <label className="grid min-w-0 text-sm text-muted">
        Length
        <select aria-label="Length" className={`${select} w-full`} value={length} onChange={(event) => { const next = event.target.value as SermonLength; setLength(next); remember({ sermonLength: next }); }}>
          {LENGTHS.map((row) => <option key={row.id} value={row.id}>{row.label} · about {row.words} words</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !ready} onClick={() => void make()} className="min-h-11 bg-garnet px-5 text-paper disabled:opacity-40">{busy ? "Working…" : "Make the sermon"}</button>
      </div>
      <Advanced>
        <label className="grid gap-1 text-sm text-muted">
          Guidance
          <textarea aria-label="Guidance" rows={3} value={guidance} onChange={(event) => { setGuidance(event.target.value); remember({ sermonGuidance: event.target.value }); }} placeholder="Optional note to your model…" className="w-full min-w-0 whitespace-pre-wrap border border-line bg-raised p-2 text-sm leading-relaxed text-ink" />
        </label>
      </Advanced>
      {status && <p role="status" className="text-sm text-muted">{status}</p>}
      {sermon && (
        <div className="grid min-w-0 gap-2" data-studio-output="sermon">
          <label className="grid min-w-0 gap-1">
            <span className="text-xs tracking-widest text-gold">SERMON</span>
            <textarea aria-label="Sermon text" rows={8} value={sermon} onChange={(event) => setSermon(event.target.value)} className="w-full min-w-0 whitespace-pre-wrap border border-line bg-paper p-3 font-serif leading-relaxed text-ink" />
          </label>
          {label && <p className="text-xs leading-relaxed text-muted" data-studio-label="">{label}</p>}
          <div className="flex flex-wrap text-sm">
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => void copyText()}>Copy</button>
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => void shareText()}>Share</button>
          </div>
        </div>
      )}
    </div>
  );
}
