/**
 * Direct browser calls to the reader's own provider. The key goes from this tab
 * to the provider and nowhere else. Every message shown is stripped of keys.
 */
export type Fetch = typeof fetch;
export type Failure = { ok: false; error: string; safety?: boolean };

const SECRETISH = /(?<![A-Za-z0-9])(?:xai-|sk-ant-|sk-or-|sk-|sk_|r8_|gsk_|AIza|AQ\.)[^\s"',;)]*/g;

export function redact(text: string, key?: string) {
  let out = String(text ?? "");
  if (key) out = out.split(key).join("[key]");
  return out
    .replace(/bearer\s+\S+/gi, "Bearer [key]")
    .replace(/authorization[^,;]*/gi, "authorization [hidden]")
    .replace(SECRETISH, "[key]")
    .replace(/[0-9a-f-]{36}:[0-9a-f]{32}/gi, "[key]")
    .replace(/[?&](?:key|token)=[^\s&]+/gi, "?[key]");
}

function messageOf(body: unknown): string {
  if (!body || typeof body !== "object") return typeof body === "string" ? body : "";
  const value = body as Record<string, unknown>;
  const error = value.error ?? value.detail;
  if (typeof error === "string") return error;
  if (Array.isArray(error)) return messageOf({ error: error[0] });
  if (error && typeof error === "object") {
    const inner = error as Record<string, unknown>;
    if (typeof inner.message === "string") return inner.message;
    if (typeof inner.msg === "string") return inner.msg;
  }
  return typeof value.message === "string" ? value.message : "";
}

const SAFETY = /safety|moderation|content[ _-]?polic|prohibited|blocked|violat|not allowed|refus/i;

/** One calm line: provider, status, short reason, next step. Never the raw body or the key. */
export async function failure(name: string, res: Response, key?: string): Promise<Failure> {
  let reason = "";
  try {
    const raw = (await res.text()).slice(0, 4000);
    try {
      reason = messageOf(JSON.parse(raw));
    } catch {
      reason = "";
    }
  } catch {
    reason = "";
  }
  reason = redact(reason, key).replace(/\s+/g, " ").trim().slice(0, 160).replace(/[.\s…]+$/, "");
  if (SAFETY.test(reason) || res.status === 451) {
    return { ok: false, safety: true, error: `${name} declined this for safety. Try a gentler, more reverent description.` };
  }
  const next =
    res.status === 401 || res.status === 403
      ? `${name} did not accept this key. Check it, or reconnect.`
      : res.status === 402
        ? "This needs credits on your account."
        : res.status === 404
          ? "That model is not available to this key. Pick another model."
          : res.status === 429
            ? "Your account is rate limited right now. Wait a little, then try again."
            : res.status >= 500
              ? `${name} is busy. Try again shortly.`
              : "Check the settings and try again.";
  return { ok: false, error: `${name} returned HTTP ${res.status}${reason ? `: ${reason}` : ""}. ${next}` };
}

export function networkFailure(name: string, error: unknown): Failure {
  if ((error as { name?: string })?.name === "AbortError") return { ok: false, error: "Stopped." };
  return { ok: false, error: `Could not reach ${name}. Check your connection. Your provider may still finish or bill work that already started.` };
}
