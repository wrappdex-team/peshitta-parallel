import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <main className="mx-auto min-h-app max-w-3xl px-5 pt-safe pb-page">
      <div className="pt-8">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          Injeel
        </Link>
        <h1 className="mt-6 font-serif text-4xl">Privacy</h1>
        <p className="mt-4 text-base leading-relaxed">
          Injeel does not ask for an account. The chapter you last read, the languages beside it, and any voice clip already played stay on this device.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Pressing Read sends that chapter’s text to make the spoken voice, and only then. Studio sends the line you chose, and only when you ask it to.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted">
          The site and the installed app are the same reader. Putting Injeel on a home screen does not collect anything more.
        </p>
      </div>
    </main>
  );
}
