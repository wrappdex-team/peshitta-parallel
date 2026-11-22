/**
 * One film shot on the reader's own account: Gemini Omni (Interactions API),
 * Grok Imagine Video, or fal Kling. Shapes follow provider docs (Nov 2026);
 * untested against live accounts. Every request goes straight to the provider.
 */
import { provider, type ProviderId } from "../catalog.ts";
import { failure, networkFailure, type Failure, type Fetch } from "../http.ts";
import { inlineMedia } from "./song.ts";
import { falQueue } from "./fal.ts";

export type FilmAspect = "16:9" | "9:16" | "1:1";
export type ShotAsk = { id: ProviderId; key: string; model: string; prompt: string; seconds: number; aspect: FilmAspect };
export type ShotResult = { ok: true; src: string; mime: string } | Failure;
type Poll = { every?: number; tries?: number; onWait?: (n: number) => void };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const safety = (name: string): Failure => ({ ok: false, safety: true, error: `${name} declined this for safety. Try a gentler description.` });
const slow = (name: string): Failure => ({ ok: false, error: `${name} is still working on this shot. It may finish and bill later; check your account before trying again.` });

type Step = { content?: { type?: string; data?: string; uri?: string; mime_type?: string }[] };
type Interaction = { id?: string; status?: string; error?: { message?: string }; steps?: Step[] };

async function omni(ask: ShotAsk, fetcher: Fetch, poll: Poll): Promise<ShotResult> {
  const name = provider("google").name;
  const headers = { "Content-Type": "application/json", "x-goog-api-key": ask.key };
  const root = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const start = await fetcher(root, { method: "POST", headers, body: JSON.stringify({ model: ask.model, input: ask.prompt, response_format: { type: "video", aspect_ratio: ask.aspect, resolution: "720p", duration: `${Math.max(3, Math.min(15, ask.seconds))}s` } }) });
  if (!start.ok) return failure(name, start, ask.key);
  let job = (await start.json()) as Interaction;
  for (let n = 0; n < (poll.tries ?? 90) && job.status !== "completed"; n++) {
    if (job.status === "failed" || job.status === "cancelled") return /safety|policy|blocked/i.test(job.error?.message ?? "") ? safety(name) : { ok: false, error: `${name} could not make this shot. Try again.` };
    if (!job.id || !/^[\w./-]+$/.test(job.id)) return { ok: false, error: `${name} returned an unexpected job. Try again.` };
    await wait(poll.every ?? 5000);
    poll.onWait?.(n);
    const res = await fetcher(`${root}/${job.id}`, { headers: { "x-goog-api-key": ask.key } });
    if (!res.ok) return failure(name, res, ask.key);
    job = (await res.json()) as Interaction;
  }
  if (job.status !== "completed") return slow(name);
  const video = job.steps?.flatMap((step) => step.content ?? []).find((part) => part.type === "video");
  if (video?.data) return { ok: true, src: inlineMedia(video.data, video.mime_type ?? "video/mp4"), mime: video.mime_type ?? "video/mp4" };
  if (video?.uri?.startsWith("https://generativelanguage.googleapis.com/")) {
    const file = await fetcher(video.uri, { headers: { "x-goog-api-key": ask.key } });
    if (!file.ok) return failure(name, file, ask.key);
    const blob = await file.blob();
    return { ok: true, src: URL.createObjectURL(blob), mime: blob.type || "video/mp4" };
  }
  return { ok: false, error: `${name} returned no video. Try again.` };
}

async function grok(ask: ShotAsk, fetcher: Fetch, poll: Poll): Promise<ShotResult> {
  const name = provider("xai").name;
  const auth = { Authorization: `Bearer ${ask.key}` };
  const start = await fetcher("https://api.x.ai/v1/videos/generations", { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ model: ask.model, prompt: ask.prompt, duration: Math.max(1, Math.min(15, ask.seconds)), aspect_ratio: ask.aspect, resolution: "720p" }) });
  if (!start.ok) return failure(name, start, ask.key);
  const id = ((await start.json()) as { request_id?: string }).request_id ?? "";
  if (!/^[\w-]+$/.test(id)) return { ok: false, error: `${name} returned an unexpected job. Try again.` };
  for (let n = 0; n < (poll.tries ?? 90); n++) {
    await wait(poll.every ?? 5000);
    poll.onWait?.(n);
    const res = await fetcher(`https://api.x.ai/v1/videos/${id}`, { headers: auth });
    if (!res.ok) return failure(name, res, ask.key);
    const body = (await res.json()) as { status?: string; video?: { url?: string; respect_moderation?: boolean }; error?: string };
    if (body.status === "done") {
      if (body.video?.respect_moderation === false) return safety(name);
      return body.video?.url?.startsWith("https://") ? { ok: true, src: body.video.url, mime: "video/mp4" } : { ok: false, error: `${name} returned no video. Try again.` };
    }
    if (body.status === "failed" || body.status === "expired") return /moderat|safety/i.test(body.error ?? "") ? safety(name) : { ok: false, error: `${name} could not make this shot. Try again.` };
  }
  return slow(name);
}

export async function makeShot(ask: ShotAsk, fetcher: Fetch = fetch, poll: Poll = {}): Promise<ShotResult> {
  const name = provider(ask.id).name;
  try {
    if (ask.id === "google") return await omni(ask, fetcher, poll);
    if (ask.id === "xai") return await grok(ask, fetcher, poll);
    if (ask.id === "fal") {
      const out = await falQueue(ask.model, ask.key, { prompt: ask.prompt.slice(0, 2500), duration: ask.seconds >= 10 ? "10" : "5", aspect_ratio: ask.aspect, negative_prompt: "blur, distortion, text, captions, gore, nudity" }, fetcher, undefined, poll);
      if (!out.ok) return out;
      const url = (out.body.video as { url?: string } | undefined)?.url ?? "";
      return url.startsWith("https://") ? { ok: true, src: url, mime: "video/mp4" } : { ok: false, error: "fal returned no video. Try again." };
    }
    return { ok: false, error: `${name} does not make films.` };
  } catch (error) {
    return networkFailure(name, error);
  }
}
