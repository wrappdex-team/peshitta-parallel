import { useCallback, useState } from "react";
import type { ProviderId } from "./catalog.ts";
import { connections } from "./vault.ts";

/** The tab's connections, re-read after every change. Keys never leave this hook's caller. */
export function useConnections() {
  const [keys, setKeys] = useState(() => connections());
  const refresh = useCallback(() => setKeys(connections()), []);
  const ids = Object.keys(keys) as ProviderId[];
  return { keys, ids, refresh };
}
