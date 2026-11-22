/**
 * The reader's own connections, for this tab only.
 * Everything lives in sessionStorage["injeel-agent"] as {"v":2,"keys":{…}}.
 * Never localStorage, never sent to INjeel, never logged.
 */
import { cleanKey, detectProvider, isProviderId, type ProviderId } from "./catalog.ts";

export const VAULT_KEY = "injeel-agent";
type Keys = Partial<Record<ProviderId, string>>;
/** One-time OAuth PKCE state. The verifier never goes in a URL. */
export type Pending = { verifier: string; returnTo: string; at: number };
type Vault = { v: 2; keys: Keys; pending?: Pending };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(given?: Store): Store | null {
  if (given) return given;
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): Vault {
  const empty: Vault = { v: 2, keys: {} };
  if (!raw) return empty;
  if (!raw.trim().startsWith("{")) {
    // A classic Studio key: keep it as one connection when its provider is known.
    const id = detectProvider(raw);
    return id ? { v: 2, keys: { [id]: cleanKey(raw) } } : empty;
  }
  try {
    const body = JSON.parse(raw) as Partial<Vault>;
    const keys: Keys = {};
    for (const [id, key] of Object.entries(body.keys ?? {})) {
      if (isProviderId(id) && typeof key === "string" && key) keys[id] = key;
    }
    const p = body.pending;
    const pending = p && typeof p.verifier === "string" && typeof p.returnTo === "string" ? { verifier: p.verifier, returnTo: p.returnTo, at: Number(p.at) || 0 } : undefined;
    return { v: 2, keys, ...(pending ? { pending } : {}) };
  } catch {
    return empty;
  }
}

export function readVault(given?: Store): Vault {
  const s = store(given);
  try {
    return parse(s?.getItem(VAULT_KEY) ?? null);
  } catch {
    return { v: 2, keys: {} };
  }
}

function write(vault: Vault, given?: Store) {
  const s = store(given);
  if (!s) return false;
  try {
    if (!Object.keys(vault.keys).length && !vault.pending) s.removeItem(VAULT_KEY);
    else s.setItem(VAULT_KEY, JSON.stringify(vault));
    return true;
  } catch {
    return false;
  }
}

export function connections(given?: Store) {
  return readVault(given).keys;
}

export function connect(id: ProviderId, key: string, given?: Store) {
  const vault = readVault(given);
  return write({ ...vault, keys: { ...vault.keys, [id]: cleanKey(key) } }, given);
}

export function disconnect(id: ProviderId, given?: Store) {
  const vault = readVault(given);
  const keys = { ...vault.keys };
  delete keys[id];
  return write({ ...vault, keys }, given);
}

export function disconnectAll(given?: Store) {
  const s = store(given);
  try {
    s?.removeItem(VAULT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function setPending(pending: Pending | undefined, given?: Store) {
  const vault = readVault(given);
  const next: Vault = { v: 2, keys: vault.keys };
  if (pending) next.pending = pending;
  return write(next, given);
}
