export type AgentKind = "xai" | "openai" | "anthropic";

export type Agent = { kind: AgentKind; key: string };

/** Recognize supported key formats; acceptance is still decided by the provider. */
export function detectAgent(raw: string): Agent | null {
  const key = raw.trim();
  if (key.length < 20 || key.length > 300) return null;
  if (key.startsWith("xai-")) return { kind: "xai", key };
  if (key.startsWith("sk-ant-")) return { kind: "anthropic", key };
  if (key.startsWith("sk-")) return { kind: "openai", key };
  return null;
}

export function resolveAgent(agentKey?: string): Agent | null {
  const supplied = String(agentKey ?? "").trim();
  // Only omission/blank input opts into the existing optional site-funded path.
  // An explicit unrecognized key must not silently select a different payer.
  if (supplied) return detectAgent(supplied);
  const site = detectAgent(process.env.XAI_API_KEY || "");
  return site?.kind === "xai" ? site : null;
}

export const AGENT_STORE = "injeel-agent";
