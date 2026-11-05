export type AgentKind = "xai" | "openai" | "anthropic";

export type Agent = { kind: AgentKind; key: string };

/** Tell an xAI, OpenAI, or Claude key apart. The key stays on the reader's device. */
export function detectAgent(raw: string): Agent | null {
  const key = raw.trim();
  if (key.length < 20 || key.length > 300) return null;
  if (key.startsWith("xai-")) return { kind: "xai", key };
  if (key.startsWith("sk-ant-")) return { kind: "anthropic", key };
  if (key.startsWith("sk-")) return { kind: "openai", key };
  return null;
}

export function resolveAgent(agentKey?: string): Agent | null {
  const given = detectAgent(String(agentKey ?? ""));
  if (given) return given;
  const site = detectAgent(process.env.XAI_API_KEY || "");
  return site?.kind === "xai" ? site : null;
}

export const AGENT_STORE = "injeel-agent";
