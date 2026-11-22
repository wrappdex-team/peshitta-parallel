/** fal queue: submit, poll the status URL, then read the result (docs: fal.ai queue API). */
import { failure, networkFailure, type Failure, type Fetch } from "../http.ts";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("Stopped"), { name: "AbortError" })); }, { once: true });
  });

export async function falQueue(model: string, key: string, input: Record<string, unknown>, fetcher: Fetch, signal?: AbortSignal, { every = 4000, tries = 90, onWait }: { every?: number; tries?: number; onWait?: (n: number) => void } = {}): Promise<{ ok: true; body: Record<string, unknown> } | Failure> {
  const headers = { "Content-Type": "application/json", Authorization: `Key ${key}` };
  try {
    const submit = await fetcher(`https://queue.fal.run/${model}`, { method: "POST", signal, headers, body: JSON.stringify(input) });
    if (!submit.ok) return await failure("fal", submit, key);
    const job = (await submit.json()) as { status_url?: string; response_url?: string };
    const status = job.status_url ?? "";
    const response = job.response_url ?? "";
    if (!/^https:\/\/queue\.fal\.run\//.test(status) || !/^https:\/\/queue\.fal\.run\//.test(response)) return { ok: false, error: "fal returned an unexpected job. Try again." };
    for (let n = 0; n < tries; n++) {
      await wait(every, signal);
      onWait?.(n);
      const res = await fetcher(status, { headers: { Authorization: `Key ${key}` }, signal });
      if (!res.ok) return await failure("fal", res, key);
      const state = ((await res.json()) as { status?: string }).status;
      if (state === "COMPLETED") {
        const done = await fetcher(response, { headers: { Authorization: `Key ${key}` }, signal });
        if (!done.ok) return await failure("fal", done, key);
        return { ok: true, body: (await done.json()) as Record<string, unknown> };
      }
    }
    return { ok: false, error: "fal is still working. It may finish and bill later; check your fal dashboard before trying again." };
  } catch (error) {
    return networkFailure("fal", error);
  }
}
