/**
 * "Sign in with OpenRouter": OAuth PKCE (S256). OpenRouter issues a key on the
 * reader's own account; it goes straight into this tab's session vault.
 * Docs: https://openrouter.ai/docs/guides/overview/auth/oauth
 */
import { connect, readVault, setPending } from "./vault.ts";
import type { Fetch } from "./http.ts";

export const CALLBACK_PATH = "/connected";
const TEN_MINUTES = 10 * 60 * 1000;

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Only same-site reading paths are allowed back. */
export function safeReturn(path: string) {
  return /^\/(?:read\/[a-z0-9-]+\/\d+|words|names|saved|study|guide)?(?:[?#][\w=&.%-]*)?$/i.test(path) ? path : "/";
}

export async function openRouterSignInUrl(origin: string, returnTo: string) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  if (!setPending({ verifier, returnTo: safeReturn(returnTo), at: Date.now() })) return null;
  const params = new URLSearchParams({
    callback_url: `${origin}${CALLBACK_PATH}`,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256",
  });
  return `https://openrouter.ai/auth?${params}`;
}

export type Finish = { ok: true; returnTo: string } | { ok: false; error: string; returnTo: string };

export async function finishOpenRouterSignIn(code: string, fetcher: Fetch = fetch, now = Date.now()): Promise<Finish> {
  const pending = readVault().pending;
  const returnTo = pending?.returnTo ?? "/";
  setPending(undefined);
  if (!pending || now - pending.at > TEN_MINUTES) return { ok: false, returnTo, error: "That sign-in expired. Start again from Studio · Connections." };
  if (!/^[\w-]{6,200}$/.test(code)) return { ok: false, returnTo, error: "OpenRouter did not send a usable sign-in code." };
  try {
    const res = await fetcher("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: pending.verifier, code_challenge_method: "S256" }),
    });
    if (!res.ok) return { ok: false, returnTo, error: `OpenRouter returned HTTP ${res.status}. Start the sign-in again.` };
    const body = (await res.json()) as { key?: unknown };
    if (typeof body.key !== "string" || !body.key) return { ok: false, returnTo, error: "OpenRouter did not return a key." };
    if (!connect("openrouter", body.key)) return { ok: false, returnTo, error: "This browser blocked tab storage, so the connection could not be kept." };
    return { ok: true, returnTo };
  } catch {
    return { ok: false, returnTo, error: "Could not reach OpenRouter. Start the sign-in again." };
  }
}
