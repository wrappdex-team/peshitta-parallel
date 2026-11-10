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

/**
 * First row for a kind+task is the default. Unknown ids are ignored.
 * Ids were checked against each provider's published model list on 9 Nov 2026:
 * OpenRouter /api/v1/models (prompt and completion price both 0), Groq's
 * supported-models page, Gemini's pricing page (free tier), and the Workers AI
 * model pages. When a key's own list is available, Studio narrows to the rows
 * that list returns (see availableModels).
 *
 * Image rows exist only where the provider has a still model a visitor key can
 * call: xAI, OpenAI and Cloudflare. OpenRouter lists no $0 image model, Groq has
 * no image model, and Gemini image models are not on the free tier.
 */
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
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    free: true,
    note: "Larger Groq model. Same free-plan limits, counted separately.",
  },
  {
    kind: "gemini",
    task: "shape",
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    free: true,
    note: "Free tier for AI Studio keys. Google may use free prompts to improve its products.",
  },
  {
    kind: "gemini",
    task: "shape",
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    free: true,
    note: "Stronger free-tier Gemini. Often busy (HTTP 503) at peak times.",
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

/** Catalog rows for a kind+task that the key's own model list confirmed. */
export function availableModels(kind: AgentKind, task: StudioTask, listed?: readonly string[] | null) {
  const rows = modelsFor(kind, task);
  if (!listed || !listed.length) return rows;
  const confirmed = rows.filter((model) => listed.includes(model.id));
  return confirmed.length ? confirmed : rows;
}

const NAMES: Record<AgentKind, string> = {
  xai: "xAI",
  openai: "OpenAI",
  anthropic: "Claude",
  openrouter: "OpenRouter",
  groq: "Groq",
  gemini: "Gemini",
  cloudflare: "Cloudflare",
};

const FREE_STILL = "For a free still, save a Cloudflare Workers AI token (cfut_ or cfat_) with its account id. An xAI or OpenAI key also works.";

/** Why this key cannot make the still, naming the key that can. */
export function stillBlock(kind: AgentKind) {
  switch (kind) {
    case "openrouter":
      return `OpenRouter lists no $0 image model, so this key cannot make the still. ${FREE_STILL}`;
    case "groq":
      return `Groq has no image model, so this key cannot make the still. ${FREE_STILL}`;
    case "gemini":
      return `Gemini's free tier has no image model, so this key cannot make the still. ${FREE_STILL}`;
    case "anthropic":
      return `Claude has no image API, so this key cannot make the still. ${FREE_STILL}`;
    default:
      return "";
  }
}

/** Line shown when a task button is unavailable for this key. */
export function blockLine(kind: AgentKind, task: Exclude<StudioTask, "shape">) {
  if (supportsTask(kind, task)) return "";
  if (task === "video") return `Film needs an xAI key. This ${NAMES[kind]} key can still shape the prompt.`;
  if (task === "audio") return `A generated voice needs your own xAI or OpenAI key. Device Read needs no key. This ${NAMES[kind]} key can still shape the words.`;
  return stillBlock(kind) || `This ${NAMES[kind]} key cannot make the still. ${FREE_STILL}`;
}

/** Status after a successful shape. It never promises a still this key cannot make. */
export function shapedLine(kind: AgentKind, task: Exclude<StudioTask, "shape">) {
  const thing = task === "image" ? "the still" : task === "video" ? "the film" : "the voice";
  if (supportsTask(kind, task)) return `The prompt is ready. You can change it before making ${thing}.`;
  if (task === "image") {
    return `The prompt is ready. This ${NAMES[kind]} key shapes prompts only and cannot make the still. ${FREE_STILL}`;
  }
  if (task === "video") return `The prompt is ready. This ${NAMES[kind]} key cannot make the film. Film needs an xAI key.`;
  return `The prompt is ready. This ${NAMES[kind]} key cannot make a generated voice. That needs an xAI or OpenAI key. Device Read needs no key.`;
}
