import { lazy, Suspense, useEffect, useState } from "react";
import { onOpenStudio, useStudioEnabled, type StudioScope } from "./prefs.ts";

const Workspace = lazy(() => import("./workspace.tsx"));

/** Mounted by reading pages. Renders nothing until Studio is on and opened. */
export function StudioHost() {
  const enabled = useStudioEnabled();
  const [scope, setScope] = useState<StudioScope | null>(null);
  useEffect(() => onOpenStudio(setScope), []);
  if (!enabled || !scope) return null;
  return (
    <Suspense fallback={null}>
      <Workspace scope={scope} onClose={() => setScope(null)} />
    </Suspense>
  );
}
