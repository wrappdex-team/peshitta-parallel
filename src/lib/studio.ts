import { createServerFn } from "@tanstack/react-start";

export type StudioKind = "image" | "video" | "audio";

const hits = new Map<string, number[]>();

function allow(key: string, limit: number) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

async function caller() {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const forwarded = getRequest().headers.get("x-forwarded-for");
    return forwarded?.split(",")[0]?.trim() || "reader";
  } catch {
    return "reader";
  }
}

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function keyOf(agentKey: string | undefined) {
  const given = String(agentKey ?? "").trim();
  if (given && /^xai-[A-Za-z0-9_-]{16,}$/.test(given)) return given;
  return process.env.XAI_API_KEY || "";
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

export const shapePrompt = createServerFn({ method: "POST" })
  .validator((input: { text: string; style: string; kind: StudioKind; language?: string; agentKey?: string }) => {
    const text = clip(String(input?.text ?? ""), 1200);
    const style = clip(String(input?.style ?? ""), 400);
    const language = clip(String(input?.language ?? ""), 60);
    const kind = input?.kind;
    if (!text || (kind !== "image" && kind !== "video" && kind !== "audio")) {
      throw new Error("Choose a passage and a kind of work.");
    }
    return { text, style, kind, language, agentKey: String(input?.agentKey ?? "") };
  })
  .handler(async ({ data }) => {
    const apiKey = keyOf(data.agentKey);
    if (!apiKey) return { ok: false as const, error: "Connect your agent first." };
    const ip = await caller();
    if (!allow(`${ip}:shape`, 30)) return { ok: false as const, error: "The studio needs a short rest." };

    const role =
      data.kind === "audio"
        ? `Write a short spoken reading of the passage in ${data.language || "the same language as the passage"}. Return only the lines to be spoken.`
        : data.kind === "video"
          ? "Write one image-and-motion prompt for a quiet 6-second film of the passage. No people as identifiable living persons. Return only the prompt."
          : "Write one still-image prompt for the passage. No identifiable living persons. Return only the prompt.";

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You help a reader make art from a passage of the Peshitta New Testament. Stay close to the words given. Do not add doctrine that is not in the passage. Keep the prompt under 80 words.",
          },
          { role: "user", content: `${role}\nPassage: ${data.text}\nStyle the reader asked for: ${data.style || "quiet manuscript light"}` },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: data.agentKey ? "That agent key was not accepted." : "The prompt could not be shaped. Try again." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const prompt = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!prompt) return { ok: false as const, error: "The prompt came back empty." };
    return { ok: true as const, prompt };
  });

export const makeImage = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; agentKey?: string }) => {
    const prompt = clip(String(input?.prompt ?? ""), 800);
    if (!prompt) throw new Error("Write a prompt first.");
    return { prompt, agentKey: String(input?.agentKey ?? "") };
  })
  .handler(async ({ data }) => {
    const apiKey = keyOf(data.agentKey);
    if (!apiKey) return { ok: false as const, error: "Connect your agent first." };
    const ip = await caller();
    if (!allow(`${ip}:image`, 8)) return { ok: false as const, error: "Image making needs a short rest." };

    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt: data.prompt,
        n: 1,
        response_format: "b64_json",
      }),
    });
    if (!res.ok) return { ok: false as const, error: "The image could not be made. Try a shorter prompt." };
    const body = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const first = body.data?.[0];
    if (first?.b64_json) return { ok: true as const, src: `data:image/png;base64,${first.b64_json}` };
    if (first?.url) return { ok: true as const, src: first.url };
    return { ok: false as const, error: "No image came back." };
  });

export const startVideo = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; agentKey?: string }) => {
    const prompt = clip(String(input?.prompt ?? ""), 800);
    if (!prompt) throw new Error("Write a prompt first.");
    return { prompt, agentKey: String(input?.agentKey ?? "") };
  })
  .handler(async ({ data }) => {
    const apiKey = keyOf(data.agentKey);
    if (!apiKey) return { ok: false as const, error: "Connect your agent first." };
    const ip = await caller();
    if (!allow(`${ip}:video`, 3)) return { ok: false as const, error: "Video making needs a short rest." };

    const res = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-imagine-video-1.5",
        prompt: data.prompt,
        duration: 6,
      }),
    });
    if (!res.ok) return { ok: false as const, error: "The film could not be started." };
    const body = (await res.json()) as { request_id?: string };
    if (!body.request_id) return { ok: false as const, error: "No film request came back." };
    return { ok: true as const, requestId: body.request_id };
  });

export const checkVideo = createServerFn({ method: "POST" })
  .validator((input: { requestId: string; agentKey?: string }) => {
    const requestId = String(input?.requestId ?? "");
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(requestId)) throw new Error("That film request is not valid.");
    return { requestId, agentKey: String(input?.agentKey ?? "") };
  })
  .handler(async ({ data }) => {
    const apiKey = keyOf(data.agentKey);
    if (!apiKey) return { ok: false as const, error: "Connect your agent first." };
    const res = await fetch(`https://api.x.ai/v1/videos/${data.requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { ok: false as const, error: "The film could not be checked." };
    const body = (await res.json()) as { status?: string; video?: { url?: string } };
    if (body.status === "done" && body.video?.url) return { ok: true as const, status: "done" as const, src: body.video.url };
    if (body.status === "failed" || body.status === "expired") return { ok: false as const, error: "The film did not finish." };
    return { ok: true as const, status: "waiting" as const };
  });

const VOICES = new Set([
  "ara", "rex", "eve", "leo", "luna", "orion", "aurora", "atlas", "iris", "helios", "celeste", "cosmo",
]);

export const makeAudio = createServerFn({ method: "POST" })
  .validator((input: { text: string; voice: string; language?: string; agentKey?: string }) => {
    const text = clip(String(input?.text ?? ""), 700);
    const voice = String(input?.voice ?? "ara").trim().toLowerCase();
    const language = clip(String(input?.language ?? "English"), 60);
    if (!text) throw new Error("Choose a passage first.");
    if (!/^[a-z0-9_-]{2,40}$/.test(voice)) throw new Error("That voice is not usable.");
    return { text, voice, language, agentKey: String(input?.agentKey ?? "") };
  })
  .handler(async ({ data }) => {
    const apiKey = keyOf(data.agentKey);
    if (!apiKey) return { ok: false as const, error: "Connect your agent first." };
    const ip = await caller();
    if (!allow(`${ip}:audio`, 12)) return { ok: false as const, error: "Audio making needs a short rest." };

    const code = TTS_CODE[data.language.toLowerCase()] || "auto";
    let spoken = data.text;
    if (data.language && data.language.toLowerCase() !== "english") {
      const tr = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            { role: "system", content: "Translate the passage. Return only the translation, no notes." },
            { role: "user", content: `Translate into ${data.language}:\n${data.text}` },
          ],
        }),
      });
      if (tr.ok) {
        const body = (await tr.json()) as { choices?: { message?: { content?: string } }[] };
        const line = body.choices?.[0]?.message?.content?.trim();
        if (line) spoken = clip(line, 700);
      }
    }

    const voice = VOICES.has(data.voice) ? data.voice : data.voice;
    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
  });
