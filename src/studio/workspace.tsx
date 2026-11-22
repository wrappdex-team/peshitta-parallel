import { Modal } from "@/components/modal";
import { useState, type ReactNode } from "react";
import { CAPABILITIES, provider, type Capability } from "./catalog.ts";
import { ConnectionsPanel } from "./connections-panel.tsx";
import { patchStudioPrefs, readStudioPrefs, scopeRef, scopeVerses, type StudioScope } from "./prefs.ts";
import { useConnections } from "./use-connections.ts";
import type { Output } from "./result.tsx";
import { StillPanel } from "./still-panel.tsx";

export type Tab = "still" | "song" | "film";
const TABS: { id: Tab; label: string }[] = [
  { id: "still", label: "Still" },
  { id: "song", label: "Song" },
  { id: "film", label: "Film" },
];

export type PanelProps = { scope: StudioScope; keys: ReturnType<typeof useConnections>["keys"]; onConnect: () => void; onMade?: (output: Output) => void };

/** Which connected account a tab will use, or a calm nudge to connect one. */
export function Engine({ cap, keys, onConnect }: { cap: Capability; keys: PanelProps["keys"]; onConnect: () => void }) {
  const able = (Object.keys(keys) as (keyof typeof keys)[]).filter((id) => provider(id).caps[cap]?.length);
  const label = CAPABILITIES.find((row) => row.id === cap)?.label.toLowerCase();
  if (!able.length) {
    return (
      <p className="text-sm text-muted">
        None of your connections makes a {label} yet.{" "}
        <button type="button" className="min-h-11 text-garnet underline" onClick={onConnect}>Connect one</button>
      </p>
    );
  }
  const first = provider(able[0]);
  return <p className="text-sm text-muted">Uses {first.name} · {first.caps[cap]?.[0]?.label}</p>;
}

function Placeholder({ tab, ...props }: PanelProps & { tab: Tab }) {
  return (
    <div className="grid gap-2">
      <Engine cap={tab} keys={props.keys} onConnect={props.onConnect} />
    </div>
  );
}

/** Filled by the Still, Song and Film panels. */
const PANELS: Partial<Record<Tab, (props: PanelProps) => ReactNode>> = { still: (props) => <StillPanel {...props} /> };

export default function Workspace({ scope: initial, onClose }: { scope: StudioScope; onClose: () => void }) {
  const [scope, setScope] = useState(initial);
  const saved = readStudioPrefs().tab;
  const [tab, setTab] = useState<Tab>(saved === "song" || saved === "film" ? saved : "still");
  const [view, setView] = useState<"make" | "connections">("make");
  const { keys, refresh } = useConnections();
  const verses = scopeVerses(scope);
  const last = scope.verses[scope.verses.length - 1]?.v ?? scope.to;
  const choose = (next: Tab) => {
    setTab(next);
    patchStudioPrefs({ tab: next });
  };
  const props: PanelProps = { scope, keys, onConnect: () => setView("connections") };
  const Panel = PANELS[tab];

  return (
    <Modal label="Studio" className="fixed inset-0 z-40 flex items-stretch justify-center bg-scrim sm:items-center" onClose={onClose}>
      <section className="studio flex h-full w-full max-w-2xl flex-col border-line bg-paper sm:h-auto sm:max-h-sheet sm:border" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-2 border-b border-line px-4 pb-2 pt-safe">
          <div className="min-w-0 pt-3">
            <p className="text-xs tracking-widest text-gold">STUDIO</p>
            <h2 className="truncate font-serif text-2xl" data-studio-ref="">{scopeRef(scope)}</h2>
          </div>
          <div className="flex shrink-0 items-center pt-2">
            <button type="button" aria-pressed={view === "connections"} className={`min-h-11 px-2 text-sm ${view === "connections" ? "text-garnet" : "text-muted"}`} onClick={() => setView(view === "connections" ? "make" : "connections")}>
              {view === "connections" ? "Done" : "Connections"}
            </button>
            <button type="button" className="min-h-11 px-2 text-garnet" onClick={onClose}>Close</button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
          {view === "connections" ? (
            <ConnectionsPanel keys={keys} refresh={refresh} />
          ) : (
            <>
              <blockquote className="line-clamp-4 border-l-2 border-gold pl-3 font-serif leading-relaxed text-ink" data-studio-passage="">
                {verses.map((verse) => verse.en).join(" ")}
              </blockquote>
              {scope.verses.length > 1 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-1 text-sm text-muted" aria-label="Passage">
                  <label className="flex items-center gap-1">
                    From
                    <select className="min-h-11 bg-transparent text-ink" value={scope.from} onChange={(event) => { const from = Number(event.target.value); setScope({ ...scope, from, to: Math.max(from, scope.to) }); }}>
                      {scope.verses.map((verse) => <option key={verse.v} value={verse.v}>{verse.v}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    to
                    <select className="min-h-11 bg-transparent text-ink" value={scope.to} onChange={(event) => { const to = Number(event.target.value); setScope({ ...scope, to, from: Math.min(scope.from, to) }); }}>
                      {scope.verses.map((verse) => <option key={verse.v} value={verse.v}>{verse.v}</option>)}
                    </select>
                  </label>
                  <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => setScope({ ...scope, from: scope.verses[0].v, to: last })}>Whole chapter</button>
                </div>
              )}
              <div role="tablist" aria-label="Make" className="mt-4 flex border-b border-line">
                {TABS.map((row) => (
                  <button key={row.id} type="button" role="tab" aria-selected={tab === row.id} onClick={() => choose(row.id)} className={`-mb-px min-h-11 flex-1 border-b-2 font-serif text-lg ${tab === row.id ? "border-garnet text-garnet" : "border-transparent text-muted"}`}>
                    {row.label}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="pt-4">
                {Panel ? Panel(props) : <Placeholder tab={tab} {...props} />}
              </div>
              <p className="mt-6 text-xs leading-relaxed text-muted">Everything made here is labelled AI-generated, with the provider, model and verse. It is never reviewed by INjeel and is not made directly from the Syriac.</p>
            </>
          )}
        </div>
      </section>
    </Modal>
  );
}
