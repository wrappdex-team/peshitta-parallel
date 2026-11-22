/**
 * The creative director: a text model on the reader's own account writes the
 * image prompt, the lyrics arrangement or the shot list. Claude, Gemini, GPT,
 * Grok or any OpenRouter model. It never edits the verse it is given.
 */
import { provider, type ProviderId } from "../catalog.ts";
import { failure, networkFailure, type Failure, type Fetch } from "../http.ts";

export type Directed = { ok: true; text: string } | Failure;
export type DirectorTask = "still" | "song" | "film";

const SYSTEM: Record<DirectorTask, string> = {
  still: "You are an art director for reverent Christian sacred art. Rewrite the draft into one vivid image prompt under 120 words. Keep the named art style, the verse reference and the reverence rules exactly. Never add text to the image. Reply with the prompt only.",
  song: "You are a composer of sacred music. Rewrite the draft into one music prompt under 80 words: genre, instruments, structure, mood and tempo. Do not change the lyrics; they are scripture. Reply with the prompt only.",
  film: "You are a film director for reverent scripture films. Rewrite the draft into one shot description under 90 words: setting, camera move, light and sound. Keep the style and reverence rules. Reply with the shot only.",
};

function textOf(id: ProviderId, body: unknown): string {
  const b = body as {
    content?: { text?: string }[];
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    choices?: { message?: { content?: string } }[];
  };
  if (id === "anthropic") return b.content?.map((part) => part.text ?? "").join("") ?? "";
  if (id === "google") return b.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
  return b.choices?.[0]?.message?.content ?? "";
}

function requestFor(id: ProviderId, model: string, key: string, system: string, user: string, maxTokens?: number): [string, RequestInit] | null {
  const json = { "Content-Type": "application/json" };
  const tokens = maxTokens ?? (id === "anthropic" ? 400 : id === "google" ? 1024 : 1200);
  if (id === "anthropic") {
    return ["https://api.anthropic.com/v1/messages", { method: "POST", headers: { ...json, "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model, max_tokens: tokens, system, messages: [{ role: "user", content: user }] }) }];
  }
  if (id === "google") {
    return [`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { ...json, "x-goog-api-key": key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.6, maxOutputTokens: tokens } }) }];
  }
  const url = id === "openai" ? "https://api.openai.com/v1/chat/completions" : id === "xai" ? "https://api.x.ai/v1/chat/completions" : id === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "";
  if (!url) return null;
  const headers: Record<string, string> = { ...json, Authorization: `Bearer ${key}` };
  if (id === "openrouter") headers["X-Title"] = "INjeel Studio";
  return [url, { method: "POST", headers, body: JSON.stringify({ model, temperature: 0.6, max_tokens: tokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) }];
}

/** A text model on the reader's own account. Keys stay in this tab. */
export async function complete(id: ProviderId, key: string, system: string, user: string, opts: { maxTokens?: number; maxChars?: number } = {}, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<Directed> {
  const row = provider(id);
  const model = row.caps.director?.[0]?.id;
  const request = model ? requestFor(id, model, key, system, user, opts.maxTokens) : null;
  if (!model || !request) return { ok: false, error: `${row.name} cannot write here.` };
  try {
    const res = await fetcher(request[0], { ...request[1], signal });
    if (!res.ok) return await failure(row.name, res, key);
    const text = textOf(id, await res.json()).replace(/^["“]|["”]$/g, "").trim();
    const cap = opts.maxChars ?? 2000;
    return text ? { ok: true, text: text.slice(0, cap) } : { ok: false, error: `${row.name} returned an empty reply. Try again.` };
  } catch (error) {
    return networkFailure(row.name, error);
  }
}

export async function direct(id: ProviderId, key: string, task: DirectorTask, draft: string, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<Directed> {
  return complete(id, key, SYSTEM[task], draft, {}, fetcher, signal);
}
