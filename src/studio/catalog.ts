/**
 * Studio connections: which of the reader's own AI accounts can make what.
 * Model ids come from each provider's public docs (checked Nov 21 2026).
 * Nothing here is a credential, and INjeel pays for none of it.
 */
export type Capability = "still" | "song" | "film" | "voice" | "director";
export type ProviderId = "google" | "openai" | "anthropic" | "xai" | "openrouter" | "elevenlabs" | "fal" | "stability" | "free";
export type StudioModel = { id: string; label: string };
export type Provider = {
  id: ProviderId;
  name: string;
  blurb: string;
  keyUrl: string;
  placeholder: string;
  /** One-click sign-in that issues a key to this tab (OAuth PKCE). */
  oauth?: boolean;
  /** Needs no key: a third-party free service the reader opts into per tab. */
  keyless?: boolean;
  caps: Partial<Record<Capability, StudioModel[]>>;
};

export const CAPABILITIES: { id: Capability; label: string }[] = [
  { id: "still", label: "Still" },
  { id: "song", label: "Song" },
  { id: "film", label: "Film" },
  { id: "voice", label: "Voice" },
  { id: "director", label: "Director" },
];

export const PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google Gemini",
    blurb: "Stills, full songs with Lyria, and short films with Omni.",
    keyUrl: "https://aistudio.google.com/apikey",
    placeholder: "AQ.… or AIza…",
    caps: {
      still: [{ id: "gemini-nano-banana-2.1", label: "Nano Banana 2.1" }, { id: "gemini-3-pro-image", label: "Gemini 3 Pro Image" }],
      song: [{ id: "lyria-3.5", label: "Lyria 3.5" }, { id: "lyria-3-clip-preview", label: "Lyria 3 Clip (30 s)" }],
      film: [{ id: "gemini-omni-1.2-flash", label: "Omni 1.2 Flash" }],
      director: [{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }],
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    blurb: "GPT Image stills and a reciting voice.",
    keyUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-…",
    caps: {
      still: [{ id: "gpt-image-2.6-flare", label: "GPT Image 2.6 Flare" }, { id: "gpt-image-2.6-sunburst", label: "GPT Image 2.6 Sunburst" }],
      voice: [{ id: "gpt-4o-mini-tts", label: "GPT-4o mini TTS" }],
      director: [{ id: "gpt-4o-mini", label: "GPT-4o mini" }],
    },
  },
  {
    id: "anthropic",
    name: "Claude",
    blurb: "Creative director: writes the prompt, the lyrics and the shot list.",
    keyUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-…",
    caps: { director: [{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }] },
  },
  {
    id: "xai",
    name: "xAI Grok",
    blurb: "Grok Imagine stills and films.",
    keyUrl: "https://console.x.ai",
    placeholder: "xai-…",
    caps: {
      still: [{ id: "grok-imagine-image-2.0", label: "Grok Imagine 2.0" }],
      film: [{ id: "grok-imagine-video-1.5", label: "Grok Imagine Video 1.5" }],
      director: [{ id: "grok-4.5", label: "Grok 4.5" }],
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    blurb: "One sign-in for hundreds of models, including free ones.",
    keyUrl: "https://openrouter.ai/keys",
    placeholder: "sk-or-v1-…",
    oauth: true,
    caps: {
      still: [{ id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image" }],
      director: [{ id: "openrouter/free", label: "Free router" }],
    },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    blurb: "Songs with vocals from your lyrics.",
    keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    placeholder: "sk_…",
    caps: { song: [{ id: "music_v2_5", label: "Eleven Music 2.5" }] },
  },
  {
    id: "fal",
    name: "fal",
    blurb: "FLUX stills, MiniMax songs and Kling films on one key.",
    keyUrl: "https://fal.ai/dashboard/keys",
    placeholder: "key-id:secret",
    caps: {
      still: [{ id: "fal-ai/flux-2", label: "FLUX.2" }],
      song: [{ id: "minimax/music-3", label: "MiniMax Music 3" }],
      film: [{ id: "fal-ai/kling-video/v3/pro/text-to-video", label: "Kling 3 Pro" }],
    },
  },
  {
    id: "stability",
    name: "Stability AI",
    blurb: "Stable Image Ultra and Core stills.",
    keyUrl: "https://platform.stability.ai/account/keys",
    placeholder: "sk-…",
    caps: { still: [{ id: "ultra", label: "Stable Image Ultra" }, { id: "core", label: "Stable Image Core" }] },
  },
  {
    id: "free",
    name: "Free services",
    blurb: "No key, no account. Pollinations stills; Kokoro recitation and LTX Video on Hugging Face Spaces. Third-party: your prompt goes to them, images may carry a mark, and daily limits are theirs.",
    keyUrl: "https://pollinations.ai",
    placeholder: "",
    keyless: true,
    caps: {
      still: [{ id: "sana", label: "Pollinations Sana" }],
      voice: [{ id: "kokoro", label: "Kokoro 82M" }],
      film: [{ id: "ltx-video-distilled", label: "LTX Video (distilled)" }],
    },
  },
];

/** Said wherever the free services are used, so nobody mistakes them for their own account. */
export const FREE_NOTE = "Free third-party services (no key). Your prompt goes to them, not to an account of yours. Marks, limits and availability are theirs and can change.";

export function provider(id: ProviderId) {
  return PROVIDERS.find((row) => row.id === id) as Provider;
}

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDERS.some((row) => row.id === value);
}

/** Paste cleanup only. The provider still decides whether a key is accepted. */
export function cleanKey(raw: string) {
  return String(raw ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^bearer\s+/i, "")
    .replace(/\s+/g, "");
}

/** Best guess from a pasted key. Stability and OpenAI share `sk-`, so a card's own field wins. */
export function detectProvider(raw: string): ProviderId | null {
  const key = cleanKey(raw);
  if (key.length < 20 || key.length > 300) return null;
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  if (key.startsWith("xai-")) return "xai";
  if (key.startsWith("sk_")) return "elevenlabs";
  if (key.startsWith("sk-")) return "openai";
  if (key.startsWith("AIza") || key.startsWith("AQ.")) return "google";
  if (/^[0-9a-f-]{36}:[0-9a-f]{32}$/i.test(key)) return "fal";
  return null;
}

/** Whether a key pasted on this provider's card has a plausible shape for it. */
export function keyFits(id: ProviderId, raw: string) {
  const key = cleanKey(raw);
  if (key.length < 20 || key.length > 300 || !/^[\x21-\x7e]+$/.test(key)) return false;
  const guess = detectProvider(key);
  if (id === "stability") return guess === "openai";
  return guess === id;
}

/** Capability matrix: for each capability, the connected providers that can do it. */
export function matrix(connected: readonly ProviderId[]) {
  const out = {} as Record<Capability, ProviderId[]>;
  for (const cap of CAPABILITIES) out[cap.id] = PROVIDERS.filter((row) => connected.includes(row.id) && row.caps[cap.id]?.length).map((row) => row.id);
  return out;
}
