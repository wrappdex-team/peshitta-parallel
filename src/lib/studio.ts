import { createServerFn } from "@tanstack/react-start";
import { resolveAgent, type Agent } from "@/lib/agent";
import { createLocalRateLimiter } from "@/lib/local-rate-limit";
import { withProviderDeadline } from "@/lib/provider-deadline";
import { isFreeKind, resolveModel, supportsTask, type StudioTask } from "@/lib/studio-models";

export type StudioKind = "image" | "video" | "audio";

const { allow } = createLocalRateLimiter();

async function caller() {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const forwarded = request.headers.get("x-forwarded-for");
    return { ip: forwarded?.split(",")[0]?.trim() || "reader", signal: request.signal };
  } catch {
    return { ip: "reader", signal: undefined };
  }
}

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function modelOf(raw: unknown) {
  const model = String(raw ?? "").trim();
  if (!model || model.length > 80 || !/^[A-Za-z0-9_.:@/-]+$/.test(model)) return "";
  return model;
}

function agentOf(agentKey: string | undefined) {
  return resolveAgent(agentKey);
}

const TTS_CODE: Record<string, string> = {
  english: "en",
  spanish: "es-ES",
  "spanish (spain)": "es-ES",
  "spanish (mexico)": "es-MX",
  chinese: "zh",
  "chinese (simplified)": "zh",
  french: "fr",
  german: "de",
  japanese: "ja",
  korean: "ko",
  arabic: "ar-SA",
  hindi: "hi",
  portuguese: "pt-BR",
  "portuguese (brazil)": "pt-BR",
  "portuguese (portugal)": "pt-PT",
  russian: "ru",
  italian: "it",
  turkish: "tr",
  vietnamese: "vi",
  bengali: "bn",
  indonesian: "id",
  syriac: "syr",
  sureth: "syr",
};

function chatUrl(agent: Agent) {
  switch (agent.kind) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "xai":
      return "https://api.x.ai/v1/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
    case "groq":
      return "https://api.groq.com/openai/v1/chat/completions";
    case "cloudflare":
      return `https://api.cloudflare.com/client/v4/accounts/${agent.accountId}/ai/v1/chat/completions`;
    default:
      return "";
  }
}

function rejected(agent: Agent) {
  switch (agent.kind) {
    case "openai":
      return "That OpenAI key was not accepted.";
    case "anthropic":
      return "That Claude key was not accepted.";
    case "xai":
      return "That xAI key was not accepted.";
    case "openrouter":
      return "That OpenRouter key was not accepted, or the free model is busy or over its daily limit.";
    case "groq":
      return "That Groq key was not accepted, or the free model is over its rate limit.";
    case "gemini":
      return "That Gemini key was not accepted, or this model is not on your free tier.";
    case "cloudflare":
      return "That Cloudflare token was not accepted, or the daily free allocation is used up.";
  }
}

async function ask(
  agent: Agent,
  system: string,
  user: string,
  signal: AbortSignal,
  model: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  signal.throwIfAborted();
  if (agent.kind === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      signal,
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": agent.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 500, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return { ok: false, error: rejected(agent) };
    const body = (await res.json()) as { content?: { text?: string }[] };
    const text = body.content?.map((part) => part.text || "").join("").trim() ?? "";
    return text ? { ok: true, text } : { ok: false, error: "The prompt came back empty." };
  }
  if (agent.kind === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      signal,
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": agent.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
      }),
    });
    if (!res.ok) return { ok: false, error: rejected(agent) };
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() ?? "";
    return text ? { ok: true, text } : { ok: false, error: "The prompt came back empty." };
  }
  const url = chatUrl(agent);
  if (!url) return { ok: false, error: "This key cannot shape a prompt." };
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${agent.key}` };
  if (agent.kind === "openrouter") {
    headers["HTTP-Referer"] = "https://injeel.news";
    headers["X-Title"] = "Injeel";
  }
  const res = await fetch(url, {
    signal,
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return { ok: false, error: rejected(agent) };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  return text ? { ok: true, text } : { ok: false, error: "The prompt came back empty." };
}

function chosen(agent: Agent, task: StudioTask, requested: string) {
  return resolveModel(agent.kind, task, requested);
}

export const shapePrompt = createServerFn({ method: "POST" })
  .validator((input: { text: string; style: string; kind: StudioKind; language?: string; agentKey?: string; model?: string }) => {
    const text = clip(String(input?.text ?? ""), 1200);
    const style = clip(String(input?.style ?? ""), 400);
    const language = clip(String(input?.language ?? ""), 60);
    const kind = input?.kind;
    if (!text || (kind !== "image" && kind !== "video" && kind !== "audio")) {
      throw new Error("Choose a passage and a kind of work.");
    }
    return { text, style, kind, language, agentKey: String(input?.agentKey ?? ""), model: modelOf(input?.model) };
  })
  .handler(async ({ data }) => {
    const agent = agentOf(data.agentKey);
    if (!agent) return { ok: false as const, error: "Add your own xAI, OpenAI, Claude, OpenRouter, Groq, Gemini, or Cloudflare key to use Studio." };
    if (!supportsTask(agent.kind, "shape")) return { ok: false as const, error: "This key cannot shape a prompt." };
    const { ip, signal: requestSignal } = await caller();
    const free = isFreeKind(agent.kind);
    if (!allow(free ? `${ip}:shape:free` : `${ip}:shape`, free ? 12 : 30)) {
      return { ok: false as const, error: free ? "Free shaping needs a short rest. The provider daily limit still applies." : "The studio needs a short rest." };
    }

    return withProviderDeadline("generation", async (signal) => {
      const role =
        data.kind === "audio"
          ? `Write a short spoken reading of the passage in ${data.language || "the same language as the passage"}. Return only the lines to be spoken.`
          : data.kind === "video"
            ? "Write one image-and-motion prompt for a quiet 6-second film of the passage. No people as identifiable living persons. Return only the prompt."
            : "Write one still-image prompt for the passage. No identifiable living persons. Return only the prompt.";

      const shaped = await ask(
        agent,
        "You help a reader make art from a passage of the Peshitta New Testament. Stay close to the words given. Do not add doctrine that is not in the passage. No identifiable living faces. Keep the prompt under 80 words.",
        `${role}\nPassage: ${data.text}\nStyle the reader asked for: ${data.style || "quiet manuscript light"}`,
        signal,
        chosen(agent, "shape", data.model) || "",
      );
      if (!shaped.ok) return shaped;
      return { ok: true as const, prompt: shaped.text };
    }, requestSignal);
  });

export const makeImage = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; agentKey?: string; model?: string }) => {
    const prompt = clip(String(input?.prompt ?? ""), 800);
    if (!prompt) throw new Error("Write a prompt first.");
    return { prompt, agentKey: String(input?.agentKey ?? ""), model: modelOf(input?.model) };
  })
  .handler(async ({ data }) => {
    const agent = agentOf(data.agentKey);
    if (!agent) return { ok: false as const, error: "Add your own xAI, OpenAI, or Cloudflare key to make an image." };
    if (agent.kind === "anthropic") return { ok: false as const, error: "Claude can shape the prompt. A still needs an xAI or OpenAI key." };
    if (!supportsTask(agent.kind, "image")) {
      return { ok: false as const, error: "This key can shape the prompt. A still needs your own xAI key, OpenAI key, or Cloudflare Workers AI token." };
    }
    const model = chosen(agent, "image", data.model);
    if (!model) return { ok: false as const, error: "That still model is not available for this key." };
    const { ip, signal: requestSignal } = await caller();
    const free = agent.kind === "cloudflare";
    if (!allow(free ? `${ip}:image:cf` : `${ip}:image`, free ? 4 : 8)) {
      return { ok: false as const, error: free ? "Free stills need a short rest. Cloudflare’s daily allocation still applies." : "Image making needs a short rest." };
    }

    return withProviderDeadline("generation", async (signal) => {
      if (agent.kind === "cloudflare") {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${agent.accountId}/ai/run/${model}`, {
          signal,
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.key}` },
          body: JSON.stringify({ prompt: data.prompt, steps: 4 }),
        });
        if (res.status === 429) return { ok: false as const, error: "The free daily still limit was reached. It resets at 00:00 UTC." };
        if (!res.ok) return { ok: false as const, error: rejected(agent) };
        const ctype = res.headers.get("content-type") || "";
        if (ctype.includes("image/")) {
          const bytes = Buffer.from(await res.arrayBuffer()).toString("base64");
          return bytes ? { ok: true as const, src: `data:${ctype.split(";")[0]};base64,${bytes}` } : { ok: false as const, error: "No image came back." };
        }
        const body = (await res.json()) as { result?: { image?: string } | string; image?: string };
        const image = typeof body.result === "string" ? body.result : body.result?.image || body.image || "";
        if (!image) return { ok: false as const, error: "No image came back." };
        if (image.startsWith("data:") || image.startsWith("http")) return { ok: true as const, src: image };
        return { ok: true as const, src: `data:image/png;base64,${image}` };
      }

      const res = await fetch(agent.kind === "openai" ? "https://api.openai.com/v1/images/generations" : "https://api.x.ai/v1/images/generations", {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.key}` },
        body: JSON.stringify(
          agent.kind === "openai"
            ? model === "dall-e-3"
              ? { model, prompt: data.prompt, n: 1, size: "1024x1024", response_format: "b64_json" }
              : { model, prompt: data.prompt, n: 1, size: "1024x1024", quality: "medium" }
            : { model, prompt: data.prompt, n: 1, response_format: "b64_json" },
        ),
      });
      if (!res.ok) return { ok: false as const, error: "The image could not be made. Try a shorter prompt." };
      const body = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
      const first = body.data?.[0];
      if (first?.b64_json) return { ok: true as const, src: `data:image/png;base64,${first.b64_json}` };
      if (first?.url) return { ok: true as const, src: first.url };
      return { ok: false as const, error: "No image came back." };
    }, requestSignal);
  });

export const startVideo = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; agentKey?: string; model?: string }) => {
    const prompt = clip(String(input?.prompt ?? ""), 800);
    if (!prompt) throw new Error("Write a prompt first.");
    return { prompt, agentKey: String(input?.agentKey ?? ""), model: modelOf(input?.model) };
  })
  .handler(async ({ data }) => {
    const agent = agentOf(data.agentKey);
    if (!agent) return { ok: false as const, error: "Add your own xAI key to make a film." };
    if (agent.kind !== "xai") return { ok: false as const, error: "Film is an xAI studio. Paste an xAI key for that." };
    const model = chosen(agent, "video", data.model);
    if (!model) return { ok: false as const, error: "That film model is not available." };
    const { ip, signal: requestSignal } = await caller();
    if (!allow(`${ip}:video`, 3)) return { ok: false as const, error: "Video making needs a short rest." };

    return withProviderDeadline("generation", async (signal) => {
      const res = await fetch("https://api.x.ai/v1/videos/generations", {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.key}` },
        body: JSON.stringify({
          model,
          prompt: data.prompt,
          duration: 6,
        }),
      });
      if (!res.ok) return { ok: false as const, error: "The film could not be started." };
      const body = (await res.json()) as { request_id?: string };
      if (!body.request_id) return { ok: false as const, error: "No film request came back." };
      return { ok: true as const, requestId: body.request_id };
    }, requestSignal);
  });

export const checkVideo = createServerFn({ method: "POST" })
  .validator((input: { requestId: string; agentKey?: string }) => {
    const requestId = String(input?.requestId ?? "");
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(requestId)) throw new Error("That film request is not valid.");
    return { requestId, agentKey: String(input?.agentKey ?? "") };
  })
  .handler(async ({ data }) => {
    const agent = agentOf(data.agentKey);
    if (!agent) return { ok: false as const, error: "Add your own xAI key to check a film." };
    if (agent.kind !== "xai") return { ok: false as const, error: "Film is an xAI studio. Paste an xAI key for that." };
    const { signal: requestSignal } = await caller();
    return withProviderDeadline("status", async (signal) => {
      const res = await fetch(`https://api.x.ai/v1/videos/${data.requestId}`, {
        signal,
        headers: { Authorization: `Bearer ${agent.key}` },
      });
      if (!res.ok) return { ok: false as const, error: "The film could not be checked." };
      const body = (await res.json()) as { status?: string; video?: { url?: string } };
      if (body.status === "done" && body.video?.url) return { ok: true as const, status: "done" as const, src: body.video.url };
      if (body.status === "failed" || body.status === "expired") return { ok: false as const, error: "The film did not finish." };
      return { ok: true as const, status: "waiting" as const };
    }, requestSignal);
  });

const VOICES = new Set([
  "ara", "rex", "eve", "leo", "luna", "orion", "aurora", "atlas", "iris", "helios", "celeste", "cosmo",
]);

export const makeAudio = createServerFn({ method: "POST" })
  .validator((input: { text: string; voice: string; language?: string; agentKey?: string; model?: string }) => {
    const text = clip(String(input?.text ?? ""), 700);
    const voice = String(input?.voice ?? "ara").trim().toLowerCase();
    const language = clip(String(input?.language ?? "English"), 60);
    if (!text) throw new Error("Choose a passage first.");
    if (!/^[a-z0-9_-]{2,40}$/.test(voice)) throw new Error("That voice is not usable.");
    return { text, voice, language, agentKey: String(input?.agentKey ?? ""), model: modelOf(input?.model) };
  })
  .handler(async ({ data }) => {
    const agent = agentOf(data.agentKey);
    if (!agent) return { ok: false as const, error: "Add your own xAI or OpenAI key to make audio." };
    if (agent.kind === "anthropic") return { ok: false as const, error: "Claude can shape the words. Hearing them needs an xAI or OpenAI key." };
    if (agent.kind !== "xai" && agent.kind !== "openai") {
      return { ok: false as const, error: "This key can shape the words. Hearing them needs your own xAI or OpenAI key. Device Read needs no key." };
    }
    const { ip, signal: requestSignal } = await caller();
    if (!allow(`${ip}:audio`, 12)) return { ok: false as const, error: "Audio making needs a short rest." };

    return withProviderDeadline("generation", async (signal) => {
      let spoken = data.text;
      if (data.language && data.language.toLowerCase() !== "english") {
        const tr = await ask(
          agent,
          "Translate the passage. Return only the translation, no notes.",
          `Translate into ${data.language}:\n${data.text}`,
          signal,
          chosen(agent, "shape", "") || "",
        );
        if (!tr.ok) return { ok: false as const, error: "The translation could not be prepared. No audio was requested. Check your provider before trying again." };
        spoken = clip(tr.text, 700);
      }

      signal.throwIfAborted();
      if (agent.kind === "openai") {
        const voice = data.voice === "rex" ? "onyx" : data.voice === "eve" ? "nova" : data.voice === "leo" ? "echo" : "alloy";
        const made = await fetch("https://api.openai.com/v1/audio/speech", {
          signal,
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.key}` },
          body: JSON.stringify({ model: chosen(agent, "audio", data.model) || "tts-1-hd", voice, input: spoken, response_format: "mp3" }),
        });
        if (!made.ok) return { ok: false as const, error: "The voice could not make this." };
        const audio = Buffer.from(await made.arrayBuffer()).toString("base64");
        if (!audio) return { ok: false as const, error: "No audio came back." };
        return { ok: true as const, src: `data:audio/mpeg;base64,${audio}`, spoken };
      }

      const code = TTS_CODE[data.language.toLowerCase()] || "auto";
      const voice = VOICES.has(data.voice) ? data.voice : "ara";
      const res = await fetch("https://api.x.ai/v1/tts", {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.key}` },
        body: JSON.stringify({
          text: spoken,
          voice_id: voice,
          language: code,
          output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 64000 },
        }),
      });
      if (!res.ok) return { ok: false as const, error: "The voice could not make this. Try a built-in voice." };
      const buf = Buffer.from(await res.arrayBuffer());
      const ctype = res.headers.get("content-type") || "";
      let audio = "";
      if (ctype.includes("json")) {
        const body = JSON.parse(buf.toString("utf8")) as { audio?: string };
        audio = body.audio || "";
      } else {
        audio = buf.toString("base64");
      }
      if (!audio) return { ok: false as const, error: "No audio came back." };
      return { ok: true as const, src: `data:audio/mpeg;base64,${audio}`, spoken };
    }, requestSignal);
  });

async function discard(res: Response) {
  try {
    await res.body?.cancel();
  } catch {
    /* The status code is the only part we keep. */
  }
}

function probed(res: Response, accepted: string, rejected: string) {
  if (res.ok) return { ok: true as const, detail: accepted };
  if (res.status === 400 || res.status === 401 || res.status === 403) return { ok: false as const, error: rejected };
  if (res.status === 429) return { ok: false as const, error: "That key was recognized, but the provider is rate limiting it." };
  return { ok: false as const, error: "That key was recognized, but the provider could not be checked just now." };
}

/** A cheap authenticated read. It does not shape, draw, or spend an image. */
export const checkProvider = createServerFn({ method: "POST" })
  .validator((input: { agentKey?: string }) => ({ agentKey: String(input?.agentKey ?? "").slice(0, 400) }))
  .handler(async ({ data }) => {
    const agent = agentOf(data.agentKey);
    if (!agent) return { ok: false as const, error: "That key was not recognized." };
    const { ip, signal: requestSignal } = await caller();
    if (!allow(`${ip}:probe`, 8)) return { ok: false as const, error: "Key checking needs a short rest." };
    if (requestSignal?.aborted) return { ok: false as const, error: "That key was recognized, but the check was cancelled." };

    const signal = requestSignal
      ? AbortSignal.any([requestSignal, AbortSignal.timeout(12_000)])
      : AbortSignal.timeout(12_000);
    try {
      if (agent.kind === "openrouter") {
        const res = await fetch("https://openrouter.ai/api/v1/key", {
          signal,
          headers: { Authorization: `Bearer ${agent.key}`, "HTTP-Referer": "https://injeel.news", "X-Title": "Injeel" },
        });
        const result = probed(res, "OpenRouter accepted this key.", "OpenRouter did not accept that key.");
        await discard(res);
        return result;
      }
      if (agent.kind === "groq") {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          signal,
          headers: { Authorization: `Bearer ${agent.key}` },
        });
        const result = probed(res, "Groq accepted this key.", "Groq did not accept that key.");
        await discard(res);
        return result;
      }
      if (agent.kind === "gemini") {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
          signal,
          headers: { "x-goog-api-key": agent.key },
        });
        const result = probed(res, "Gemini accepted this key.", "Gemini did not accept that key.");
        await discard(res);
        return result;
      }
      if (agent.kind === "cloudflare") {
        const headers = { Authorization: `Bearer ${agent.key}` };
        const verify = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", { signal, headers });
        const account = await fetch(`https://api.cloudflare.com/client/v4/accounts/${agent.accountId}`, { signal, headers });
        const tokenOk = verify.ok;
        const accountOk = account.ok;
        await discard(verify);
        await discard(account);
        if (tokenOk && accountOk) return { ok: true as const, detail: "Cloudflare accepted the token and the account id." };
        if (tokenOk && !accountOk) return { ok: false as const, error: "Cloudflare accepted the token, but not that account id." };
        if (!tokenOk && accountOk) return { ok: true as const, detail: "Cloudflare accepted this token for that account." };
        return probed(verify.ok ? account : verify, "", "Cloudflare did not accept that token.");
      }
      if (agent.kind === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          signal,
          headers: { "x-api-key": agent.key, "anthropic-version": "2023-06-01" },
        });
        const result = probed(res, "Claude accepted this key.", "Claude did not accept that key.");
        await discard(res);
        return result;
      }
      const url = agent.kind === "openai" ? "https://api.openai.com/v1/models" : "https://api.x.ai/v1/models";
      const res = await fetch(url, { signal, headers: { Authorization: `Bearer ${agent.key}` } });
      const result = probed(
        res,
        agent.kind === "openai" ? "OpenAI accepted this key." : "xAI accepted this key.",
        agent.kind === "openai" ? "OpenAI did not accept that key." : "xAI did not accept that key.",
      );
      await discard(res);
      return result;
    } catch {
      return { ok: false as const, error: "That key was recognized, but the provider could not be checked just now." };
    }
  });

