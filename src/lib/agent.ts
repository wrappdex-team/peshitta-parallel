export type AgentKind =
  | "xai"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "gemini"
  | "cloudflare";

export type Agent = { kind: AgentKind; key: string; accountId?: string };

function bounded(key: string) {
  return key.length >= 20 && key.length <= 300;
}

function unwrap(raw: string) {
  let key = String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith("`") && key.endsWith("`"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/^bearer\s+/i, "").trim();
}

/**
 * Paste cleanup. A Cloudflare user/account token has no account id inside it,
 * so the account id may be a second field or a second pasted word.
 */
export function normalizeProviderKey(raw: string, accountId?: string) {
  const key = unwrap(raw);
  const extra = unwrap(accountId ?? "").toLowerCase();
  const compact = key.replace(/\s+/g, "");
  if (/^(cfut_|cfat_)/i.test(compact) && /^[0-9a-f]{32}$/.test(extra)) {
    return `cf-${extra}-${compact}`;
  }
  const parts = key.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 2) {
    const id = parts.find((part) => /^[0-9a-f]{32}$/i.test(part));
    const token = parts.find((part) => /^(cfut_|cfat_)/i.test(part));
    if (id && token) return `cf-${id.toLowerCase()}-${token}`;
  }
  return compact;
}

export function cloudflareHint(raw: string) {
  const key = unwrap(raw).replace(/\s+/g, "");
  if (/^cfk_/i.test(key)) return "global" as const;
  if (/^(cfut_|cfat_)/i.test(key)) return "token" as const;
  return "" as const;
}

/**
 * Recognize supported key formats. Acceptance is still decided by the provider.
 * Cloudflare is stored as `cf-` + 32-hex account id + `-` + token, because the
 * Workers AI API needs both. Pasting `cfut_`/`cfat_` plus the account id is enough.
 */
export function detectAgent(raw: string, accountId?: string): Agent | null {
  const key = normalizeProviderKey(raw, accountId);
  if (!bounded(key)) return null;
  if (key.startsWith("xai-")) return { kind: "xai", key };
  if (key.startsWith("sk-ant-")) return { kind: "anthropic", key };
  // Keep OpenRouter off the OpenAI path even when the body is not pure hex.
  if (key.startsWith("sk-or-")) return { kind: "openrouter", key };
  if (key.startsWith("sk-")) return { kind: "openai", key };
  if (key.startsWith("gsk_")) return { kind: "groq", key };
  if (key.startsWith("AIza")) return { kind: "gemini", key };
  // AI Studio keys created after May 2026. Same header as AIza keys.
  if (key.startsWith("AQ.")) return { kind: "gemini", key };
  const cloudflare = /^cf-([0-9a-f]{32})-([\x21-\x7e]{20,220})$/i.exec(key);
  if (!cloudflare) return null;
  return { kind: "cloudflare", key: cloudflare[2], accountId: cloudflare[1].toLowerCase() };
}

/** Media requests use only the visitor-supplied key, never a site credential. */
export function resolveAgent(agentKey?: string): Agent | null {
  return detectAgent(String(agentKey ?? ""));
}

export function providerName(kind: AgentKind) {
  switch (kind) {
    case "xai":
      return "xAI";
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Claude";
    case "openrouter":
      return "OpenRouter";
    case "groq":
      return "Groq";
    case "gemini":
      return "Gemini";
    case "cloudflare":
      return "Cloudflare";
  }
}

export const AGENT_STORE = "injeel-agent";
