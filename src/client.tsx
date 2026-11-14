import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";
import { getRouter } from "./router";

const readerShell = typeof document !== "undefined" && document.documentElement.dataset.shell === "read";

if (readerShell) {
  // No server markup for this URL. A hydrate would be the wrong page.
  const router = getRouter();
  void router.load().then(() => {
    startTransition(() => {
      createRoot(document).render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      );
    });
  });
} else {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}
