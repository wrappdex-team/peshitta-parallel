import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

function missingChunk(message: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = errorMessage(error);
  if (missingChunk(message)) {
    return (
      <div className="min-h-app bg-paper text-ink">
        <header className="border-b border-line bg-paper">
          <div className="mx-auto flex max-w-3xl items-center px-3">
            <a href="/" className="inline-flex min-h-11 items-center font-serif text-lg">
              Injeel
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-5 pb-page">
          <p className="mt-6 max-w-prose text-base leading-relaxed">
            This page isn't on this device yet. Reconnect, or open it once while online.
          </p>
          <p className="mt-4 flex flex-wrap gap-3">
            <a href="/" className="inline-flex min-h-11 items-center text-garnet">
              All books
            </a>
            <a href="/offline" className="inline-flex min-h-11 items-center text-garnet">
              Offline
            </a>
          </p>
        </main>
      </div>
    );
  }
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center text-ink"
      }
    >
      <span className="text-garnet" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-serif text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {message}
      </p>
    </main>
  );
}
