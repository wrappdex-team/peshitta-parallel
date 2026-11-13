import { useEffect } from "react";

/** After publish, keep the reader shell so a language stored on the device can open with no connection. */
export function ReaderCache() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/reader-sw.js").catch(() => {});
  }, []);
  return null;
}
