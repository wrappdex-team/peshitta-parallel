import type { AgentKind } from "@/lib/agent";

export type StudioTask = "shape" | "image" | "video" | "audio";

export type StudioModel = {
  kind: AgentKind;
  task: StudioTask;
  id: string;
  label: string;
  /** Free-tier route. The provider still enforces its own cap. */
  free?: boolean;
  note: string;
};

/** First row for a kind+task is the default. Unknown ids are ignored. */
export const STUDIO_MODELS: readonly StudioModel[] = [
  { kind: "xai", task: "shape", id: "grok-4.5", label: "Grok 4.5", note: "Shaping on xAI. Charges apply." },
  { kind: "xai", task: "shape", id: "grok-4.6", label: "Grok 4.6", note: "Newer Grok, if your key allows it. Charges apply." },
  { kind: "openai", task: "shape", id: "gpt-4o", label: "GPT-4o", note: "Higher-quality OpenAI shaping. Charges apply." },
  { kind: "openai", task: "shape", id: "gpt-4o-mini", label: "GPT-4o mini", note: "Faster, lower-cost OpenAI shaping." },
  { kind: "anthropic", task: "shape", id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", note: "Shapes the prompt only. Charges apply." },
  {
    kind: "openrouter",
    task: "shape",
    id: "openrouter/free",
    label: "Free model router",
    free: true,
    note: "Chooses a free model. Usually 20 a minute and 50 a day.",
  },
  {
    kind: "openrouter",
    task: "shape",
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    free: true,
    note: "Free OpenRouter model. Same daily cap. It can be busy.",
  },
  {
    kind: "openrouter",
    task: "shape",
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra",
    free: true,
    note: "Larger free model. Same daily cap. It can be busy.",
  },
  {
    kind: "groq",
    task: "shape",
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    free: true,
    note: "Fast Groq free-plan model. Per-model rate limits apply.",
  },
  {
    kind: "groq",
    task: "shape",
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    free: true,
    note: "Stronger Groq model. Same free-plan limits, counted separately.",
  },
  {
    kind: "gemini",
    task: "shape",
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    free: true,
    note: "Free tier for current AI Studio keys. Google may use free prompts to improve its products.",
  },
  {
    kind: "gemini",
    task: "shape",
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    free: true,
    note: "Older free-tier Gemini. New projects may not list it.",
  },
  {
    kind: "cloudflare",
    task: "shape",
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    label: "Llama 3.3 70B",
    free: true,
    note: "Counts against the daily Workers AI allocation. Resets at 00:00 UTC.",
  },
  {
    kind: "xai",
    task: "image",
    id: "grok-imagine-image-2.0",
    label: "Grok Imagine 2.0",
    note: "Highest Imagine still. Costs more than the original model.",
  },
  { kind: "xai", task: "image", id: "grok-imagine-image", label: "Grok Imagine", note: "Lower-cost Imagine still." },
  { kind: "openai", task: "image", id: "dall-e-3", label: "DALL·E 3", note: "Reliable OpenAI still. Charges apply." },
  {
    kind: "openai",
    task: "image",
    id: "gpt-image-1",
    label: "GPT Image 1",
    note: "Only if this model is enabled on your OpenAI key.",
  },
  {
    kind: "cloudflare",
    task: "image",
    id: "@cf/black-forest-labs/flux-1-schnell",
    label: "FLUX.1 schnell",
    free: true,
    note: "Free daily allocation, square still, 4 steps. This app allows 4 stills each 10 minutes.",
  },
  {
    kind: "xai",
    task: "video",
    id: "grok-imagine-video-1.5",
    label: "Imagine Video 1.5",
    note: "Highest 6-second film. Charges apply per second.",
  },
  {
    kind: "xai",
    task: "video",
    id: "grok-imagine-video-1.5-lite",
    label: "Imagine Video 1.5 Lite",
    note: "Lower-cost 6-second film.",
  },
  { kind: "openai", task: "audio", id: "tts-1-hd", label: "OpenAI TTS HD", note: "Clearer voice. Charges apply." },
  { kind: "openai", task: "audio", id: "tts-1", label: "OpenAI TTS", note: "Standard voice. Lower cost." },
];

export function modelsFor(kind: AgentKind, task: StudioTask) {
  return STUDIO_MODELS.filter((model) => model.kind === kind && model.task === task);
}

/** xAI voices are selected separately; every other task needs a catalog row. */
export function supportsTask(kind: AgentKind, task: StudioTask) {
  return (kind === "xai" && task === "audio") || modelsFor(kind, task).length > 0;
}

export function resolveModel(kind: AgentKind, task: StudioTask, requested?: string) {
  const rows = modelsFor(kind, task);
  if (!rows.length) return null;
  return rows.find((model) => model.id === requested)?.id ?? rows[0].id;
}

export function isFreeKind(kind: AgentKind) {
  return kind === "openrouter" || kind === "groq" || kind === "gemini" || kind === "cloudflare";
}
