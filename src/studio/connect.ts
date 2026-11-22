/** "Test connection": one cheap authenticated read per provider. It never makes media. */
import { provider, type ProviderId } from "./catalog.ts";
import { failure, networkFailure, type Fetch } from "./http.ts";

export type Probe = { ok: true; detail: string; models: string[] } | { ok: false; error: string };

function probeRequest(id: ProviderId, key: string): [string, Record<string, string>] | null {
  const bearer = { Authorization: `Bearer ${key}` };
  switch (id) {
    case "google":
      return ["https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { "x-goog-api-key": key }];
    case "openai":
      return ["https://api.openai.com/v1/models", bearer];
    case "anthropic":
      return ["https://api.anthropic.com/v1/models", { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }];
    case "xai":
      return ["https://api.x.ai/v1/models", bearer];
    case "openrouter":
      return ["https://openrouter.ai/api/v1/key", bearer];
    case "elevenlabs":
      return ["https://api.elevenlabs.io/v1/models", { "xi-api-key": key }];
    case "stability":
      return ["https://api.stability.ai/v1/user/balance", bearer];
    case "fal":
      return null;
  }
}

function idsOf(body: unknown): string[] {
  const value = (body ?? {}) as { data?: unknown; models?: unknown };
  const rows = Array.isArray(value.data) ? value.data : Array.isArray(value.models) ? value.models : Array.isArray(body) ? body : [];
  return rows
    .map((row) => String((row as { id?: string; name?: string; model_id?: string })?.id ?? (row as { name?: string })?.name ?? (row as { model_id?: string })?.model_id ?? ""))
    .map((id) => id.replace(/^models\//, ""))
    .filter(Boolean)
    .slice(0, 2000);
}

export async function testConnection(id: ProviderId, key: string, fetcher: Fetch = fetch, signal?: AbortSignal): Promise<Probe> {
  const name = provider(id).name;
  const request = probeRequest(id, key);
  // fal has no free read; the first real request checks the key.
  if (!request) return { ok: true, detail: `${name} key saved. fal checks it on your first request.`, models: [] };
  try {
    const res = await fetcher(request[0], { headers: request[1], signal });
    if (!res.ok) return await failure(name, res, key);
    let models: string[] = [];
    try {
      models = idsOf(await res.json());
    } catch {
      models = [];
    }
    return { ok: true, detail: models.length ? `${name} connected · ${models.length} models visible.` : `${name} connected.`, models };
  } catch (error) {
    return networkFailure(name, error);
  }
}
