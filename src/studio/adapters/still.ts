/**
 * Stills from the reader's own account, called directly from this tab.
 * Request shapes follow each provider's public docs (Nov 2026). Untested
 * against live accounts here; tests mock the HTTP layer.
 */
import { provider, type ProviderId } from "../catalog.ts";
import { failure, networkFailure, type Failure, type Fetch } from "../http.ts";
import type { Aspect } from "../prompt.ts";
import { freeStill } from "./free.ts";

export type StillAsk = { id: ProviderId; key: string; model: string; prompt: string; aspect: Aspect; count: number; seed?: number };
/** `src` is a data: URL or the provider's https URL. */
export type StillResult = { ok: true; images: { src: string; mime: string }[] } | Failure;

const OPENAI_SIZE: Record<Aspect, string> = { "1:1": "1024x1024", "4:5": "1024x1536", "3:2": "1536x1024", "16:9": "1536x1024", "9:16": "1024x1536" };
const FAL_SIZE: Record<Aspect, string> = { "1:1": "square_hd", "4:5": "portrait_4_3", "3:2": "landscape_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9" };
const SAFETY_STOP = /SAFETY|PROHIBITED|BLOCKLIST|RECITATION|IMAGE_SAFETY|CONTENT_FILTERED/;

function safety(name: string): Failure {
  return { ok: false, safety: true, error: `${name} declined this for safety. Try a gentler, more reverent description.` };
}

function b64(rows: unknown, mime = "image/png") {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const r = row as { b64_json?: string; url?: string; media_type?: string };
      if (r.b64_json) return { src: `data:${r.media_type || mime};base64,${r.b64_json}`, mime: r.media_type || mime };
      if (r.url && /^https:\/\//.test(r.url)) return { src: r.url, mime };
      return null;
    })
    .filter((row): row is { src: string; mime: string } => Boolean(row));
}

async function google(ask: StillAsk, fetcher: Fetch, signal?: AbortSignal): Promise<StillResult> {
  const name = provider("google").name;
  const one = async () => {
    const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ask.model)}:generateContent`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": ask.key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: ask.prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: ask.aspect } } }),
    });
    if (!res.ok) return failure(name, res, ask.key);
    const body = (await res.json()) as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] };
    const candidate = body.candidates?.[0];
    if (body.promptFeedback?.blockReason || SAFETY_STOP.test(candidate?.finishReason ?? "")) return safety(name);
    const part = candidate?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
    return part?.data ? { ok: true as const, image: { src: `data:${part.mimeType || "image/png"};base64,${part.data}`, mime: part.mimeType || "image/png" } } : { ok: false as const, error: `${name} returned no image. Try again or pick another model.` };
  };
  const results = await Promise.all(Array.from({ length: ask.count }, one));
  const images = results.flatMap((r) => ("image" in r && r.ok ? [r.image] : []));
  if (images.length) return { ok: true, images };
  return results[0] as Failure;
}

export async function makeStill(ask: StillAsk, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<StillResult> {
  const name = provider(ask.id).name;
  const count = Math.max(1, Math.min(4, Math.round(ask.count)));
  const json = { "Content-Type": "application/json" };
  try {
    if (ask.id === "google") return await google({ ...ask, count }, fetcher, signal);
    if (ask.id === "free") return await freeStill(ask.prompt, ask.aspect, Math.min(count, 2), fetcher, signal);
    let res: Response;
    if (ask.id === "openai" || ask.id === "xai") {
      const body = ask.id === "openai" ? { model: ask.model, prompt: ask.prompt, n: count, size: OPENAI_SIZE[ask.aspect], output_format: "png" } : { model: ask.model, prompt: ask.prompt, n: count, aspect_ratio: ask.aspect, response_format: "b64_json" };
      res = await fetcher(ask.id === "openai" ? "https://api.openai.com/v1/images/generations" : "https://api.x.ai/v1/images/generations", { method: "POST", signal, headers: { ...json, Authorization: `Bearer ${ask.key}` }, body: JSON.stringify(body) });
    } else if (ask.id === "openrouter") {
      res = await fetcher("https://openrouter.ai/api/v1/images", { method: "POST", signal, headers: { ...json, Authorization: `Bearer ${ask.key}`, "X-Title": "INjeel Studio" }, body: JSON.stringify({ model: ask.model, prompt: ask.prompt, n: count, aspect_ratio: ask.aspect }) });
    } else if (ask.id === "fal") {
      res = await fetcher(`https://fal.run/${ask.model}`, { method: "POST", signal, headers: { ...json, Authorization: `Key ${ask.key}` }, body: JSON.stringify({ prompt: ask.prompt, image_size: FAL_SIZE[ask.aspect], num_images: count, ...(ask.seed != null ? { seed: ask.seed } : {}), enable_safety_checker: true }) });
    } else if (ask.id === "stability") {
      const form = new FormData();
      form.set("prompt", ask.prompt);
      form.set("aspect_ratio", ask.aspect);
      form.set("output_format", "png");
      if (ask.seed != null) form.set("seed", String(ask.seed));
      res = await fetcher(`https://api.stability.ai/v2beta/stable-image/generate/${ask.model === "core" ? "core" : "ultra"}`, { method: "POST", signal, headers: { Authorization: `Bearer ${ask.key}`, Accept: "application/json" }, body: form });
    } else {
      return { ok: false, error: `${name} does not make stills.` };
    }
    if (!res.ok) return await failure(name, res, ask.key);
    const body = (await res.json()) as { data?: unknown; images?: unknown; image?: string; finish_reason?: string; has_nsfw_concepts?: boolean[] };
    if (body.finish_reason === "CONTENT_FILTERED" || body.has_nsfw_concepts?.some(Boolean)) return safety(name);
    const images = ask.id === "stability" && body.image ? [{ src: `data:image/png;base64,${body.image}`, mime: "image/png" }] : b64(body.data ?? body.images);
    return images.length ? { ok: true, images } : { ok: false, error: `${name} returned no image. Try again or pick another model.` };
  } catch (error) {
    return networkFailure(name, error);
  }
}
