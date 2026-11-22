import { useState } from "react";
import { CAPABILITIES, PROVIDERS, detectProvider, keyFits, matrix, provider, type Provider, type ProviderId } from "./catalog.ts";
import { testConnection } from "./connect.ts";
import { openRouterSignInUrl } from "./oauth.ts";
import { connect, disconnect } from "./vault.ts";

type Props = { keys: Partial<Record<ProviderId, string>>; refresh: () => void };

function Chips({ row }: { row: Provider }) {
  return (
    <span className="flex flex-wrap gap-x-2 text-xs text-gold">
      {CAPABILITIES.filter((cap) => row.caps[cap.id]?.length).map((cap) => (
        <span key={cap.id}>{cap.label}</span>
      ))}
    </span>
  );
}

export function ConnectionsPanel({ keys, refresh }: Props) {
  const [open, setOpen] = useState<ProviderId | null>(null);
  const [draft, setDraft] = useState("");
  const [quick, setQuick] = useState("");
  const [status, setStatus] = useState<Partial<Record<ProviderId, string>>>({});
  const ids = Object.keys(keys) as ProviderId[];
  const grid = matrix(ids);
  const guess = detectProvider(quick);

  async function save(id: ProviderId, raw: string) {
    if (!keyFits(id, raw)) {
      setStatus((s) => ({ ...s, [id]: `That does not look like a ${provider(id).name} key.` }));
      return;
    }
    if (!connect(id, raw)) {
      setStatus((s) => ({ ...s, [id]: "This browser blocked tab storage, so the key was not kept." }));
      return;
    }
    setDraft("");
    setQuick("");
    setOpen(null);
    refresh();
    setStatus((s) => ({ ...s, [id]: "Testing…" }));
    const probe = await testConnection(id, raw.trim());
    setStatus((s) => ({ ...s, [id]: probe.ok ? probe.detail : probe.error }));
  }

  async function test(id: ProviderId) {
    const key = keys[id];
    if (!key) return;
    setStatus((s) => ({ ...s, [id]: "Testing…" }));
    const probe = await testConnection(id, key);
    setStatus((s) => ({ ...s, [id]: probe.ok ? probe.detail : probe.error }));
  }

  async function signIn() {
    const url = await openRouterSignInUrl(window.location.origin, window.location.pathname);
    if (url) window.location.assign(url);
    else setStatus((s) => ({ ...s, openrouter: "This browser blocked tab storage, so sign-in cannot start." }));
  }

  return (
    <div data-studio-connections="">
      <p className="text-sm leading-relaxed text-muted">
        Your own AI accounts. Keys stay in this tab and go straight to the provider — never to INjeel. You pay your provider directly.
      </p>
      <label className="mt-4 block text-xs tracking-widest text-gold" htmlFor="studio-quick">PASTE ANY KEY</label>
      <div className="mt-1 flex gap-2">
        <input
          id="studio-quick"
          type="password"
          autoComplete="off"
          value={quick}
          onChange={(event) => setQuick(event.target.value)}
          placeholder="We recognise Google, OpenAI, Claude, xAI…"
          className="min-h-11 min-w-0 flex-1 border border-line bg-raised px-3 text-ink"
        />
        <button type="button" disabled={!guess} onClick={() => guess && void save(guess, quick)} className="min-h-11 shrink-0 bg-garnet px-3 text-paper disabled:opacity-40">
          {guess ? `Connect ${provider(guess).name.split(" ")[0]}` : "Connect"}
        </button>
      </div>

      {ids.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="What your connections can make">
            <thead>
              <tr className="text-xs text-gold">
                <th className="py-1 pr-2 font-normal">Connected</th>
                {CAPABILITIES.map((cap) => (
                  <th key={cap.id} className="px-1 py-1 text-center font-normal">{cap.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <tr key={id} className="border-t border-line">
                  <td className="py-2 pr-2">{provider(id).name}</td>
                  {CAPABILITIES.map((cap) => (
                    <td key={cap.id} className="text-center" aria-label={grid[cap.id].includes(id) ? `${cap.label}: yes` : `${cap.label}: no`}>
                      {grid[cap.id].includes(id) ? <span className="text-garnet">●</span> : <span className="text-line">·</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="mt-5 border-t border-line">
        {PROVIDERS.map((row) => {
          const on = Boolean(keys[row.id]);
          return (
            <li key={row.id} className="border-b border-line py-3" data-provider={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-tight">
                    {row.name} {on && <span className="text-sm text-garnet">· connected</span>}
                  </p>
                  <p className="text-sm text-muted">{row.blurb}</p>
                  <Chips row={row} />
                </div>
                {on ? (
                  <div className="flex shrink-0 flex-col items-end">
                    <button type="button" className="min-h-11 px-2 text-sm text-garnet" onClick={() => void test(row.id)}>Test</button>
                    <button type="button" className="min-h-11 px-2 text-sm text-muted" onClick={() => { disconnect(row.id); refresh(); setStatus((s) => ({ ...s, [row.id]: "Disconnected." })); }}>
                      Disconnect
                    </button>
                  </div>
                ) : row.keyless ? (
                  <button type="button" className="min-h-11 shrink-0 px-2 text-sm text-garnet" onClick={() => { connect(row.id, "no-key"); refresh(); setStatus((s) => ({ ...s, [row.id]: "On for this tab. Third-party: your prompts go to them." })); }}>
                    Turn on
                  </button>
                ) : (
                  <button type="button" aria-expanded={open === row.id} className="min-h-11 shrink-0 px-2 text-sm text-garnet" onClick={() => { setOpen(open === row.id ? null : row.id); setDraft(""); }}>
                    Connect
                  </button>
                )}
              </div>
              {open === row.id && !on && (
                <div className="mt-2 grid gap-2">
                  {row.oauth && (
                    <button type="button" className="min-h-11 bg-garnet px-3 text-paper" onClick={() => void signIn()}>
                      Sign in with {row.name}
                    </button>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      aria-label={`${row.name} key`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={row.placeholder}
                      className="min-h-11 min-w-0 flex-1 border border-line bg-raised px-3 text-ink"
                    />
                    <button type="button" disabled={!draft.trim()} className="min-h-11 shrink-0 border border-garnet px-3 text-garnet disabled:opacity-40" onClick={() => void save(row.id, draft)}>
                      Save &amp; test
                    </button>
                  </div>
                  <a className="text-sm text-garnet underline" href={row.keyUrl} target="_blank" rel="noreferrer">Get a {row.name} key ↗</a>
                </div>
              )}
              {status[row.id] && <p role="status" className="mt-1 text-sm text-muted">{status[row.id]}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
