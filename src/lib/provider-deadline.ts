// Application I/O budgets, not provider SLAs or guarantees of cancellation/billing.
export const PROVIDER_DEADLINES = { generation: 240_000, status: 15_000 } as const;
type Operation = keyof typeof PROVIDER_DEADLINES;

/** Consume the complete provider response inside work; do not return a raw Response. */
export async function withProviderDeadline<T>(
  operation: Operation,
  work: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal,
): Promise<T | { ok: false; error: string }> {
  const failure = (reason: "timeout" | "cancelled" | "failed") => ({
    ok: false as const,
    error:
      operation === "status"
        ? `The film status request ${reason === "timeout" ? "timed out" : reason === "cancelled" ? "was cancelled" : "could not be completed"}. Your existing film may still finish. Check your provider before starting another. No new film was requested.`
        : `The provider request ${reason === "timeout" ? "timed out" : reason === "cancelled" ? "was cancelled" : "could not be completed"}. The provider may still finish or bill this work. Check your provider before trying again.`,
  });
  if (parent?.aborted) return failure("cancelled");

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  let interrupt!: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    interrupt = () => reject(new Error("Provider operation interrupted"));
  });
  controller.signal.addEventListener("abort", interrupt, { once: true });
  parent?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PROVIDER_DEADLINES[operation]);

  try {
    // Cover fetch AND body consumption, even if an adapter ignores AbortSignal.
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return work(controller.signal);
      }),
      interrupted,
    ]);
  } catch {
    // Never expose provider/transport errors, response bodies, keys or prompts.
    return failure(timedOut ? "timeout" : parent?.aborted ? "cancelled" : "failed");
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", interrupt);
    // Also release unread error bodies; successful payloads are already consumed.
    controller.abort();
  }
}
