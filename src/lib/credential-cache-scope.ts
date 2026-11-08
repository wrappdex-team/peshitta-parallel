import type { Agent } from "@/lib/agent";

/** Process-local opaque cache scope, not an account or proof of provider acceptance. */
export function createCredentialCacheScope() {
  let signingKey: Promise<CryptoKey> | undefined;
  return async (agent: Agent): Promise<string> => {
    // Lazy, non-extractable private seed; no Node import, environment or persistence.
    signingKey ??= crypto.subtle.generateKey(
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      await signingKey,
      new TextEncoder().encode(JSON.stringify([agent.kind, agent.key])),
    );
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  };
}
