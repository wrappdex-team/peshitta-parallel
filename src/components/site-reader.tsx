import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ReadAloud, type ReadAloudHandle } from "@/components/read-aloud";
import {
  getReadingSurface,
  setReadingHandle,
  subscribeReadingSurface,
  type ReadingSurface,
} from "@/lib/reading-surface";

/**
 * One read-aloud for the whole visit. Pages publish what to read; leaving them
 * shrinks the bar to a corner and the voice keeps going until Stop.
 */
export function SiteReader() {
  const surface = useSyncExternalStore(subscribeReadingSurface, getReadingSurface, () => null);
  const surfaceRef = useRef<ReadingSurface | null>(surface);
  const handleRef = useRef<ReadAloudHandle>(null);
  const [snap, setSnap] = useState<ReadingSurface | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const view = surface ?? snap;
  const viewRef = useRef<ReadingSurface | null>(view);
  surfaceRef.current = surface;
  viewRef.current = view;

  useEffect(() => {
    if (surface) setSnap(surface);
  }, [surface]);

  useLayoutEffect(() => {
    setReadingHandle(handleRef.current);
    return () => setReadingHandle(null);
  });

  if (!view || (!surface && status === "idle")) return null;

  return (
    <ReadAloud
      ref={handleRef}
      book={view.book}
      chapter={view.chapter}
      voice={view.voice}
      deviceVoice={view.deviceVoice}
      speed={view.speed}
      lang={view.lang}
      fromVerse={view.fromVerse}
      loadLines={view.loadLines}
      nextPlaceOf={view.nextPlaceOf}
      startKey={view.startKey}
      fromLabel={view.fromLabel}
      kind={view.kind}
      dock={surface ? "bar" : "corner"}
      onStatus={setStatus}
      onVoice={(voice) => surfaceRef.current?.onVoice(voice)}
      onDeviceVoice={(deviceVoice) => surfaceRef.current?.onDeviceVoice(deviceVoice)}
      onSpeed={(speed) => surfaceRef.current?.onSpeed(speed)}
      onVerse={(verse) => surfaceRef.current?.onVerse(verse)}
      onHeard={(line) => surfaceRef.current?.onHeard?.(line)}
      onAdvance={(place) => surfaceRef.current?.onAdvance(place)}
      onChapter={(place) => viewRef.current?.onChapter?.(place)}
    />
  );
}
