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

/** Media requests use only the visitor-supplied key, never a site credential. */
export function resolveAgent(agentKey?: string): Agent | null {
  return detectAgent(String(agentKey ?? ""));
}

export const AGENT_STORE = "injeel-agent";
