import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Injeel" },
      {
        name: "description",
        content: "Injeel keeps your place on this device. Read uses the voice already on this device.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/privacy` }],
  }),
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
          Injeel does not ask for an account. The chapter you last read, how many times you have finished a chapter, and the languages beside it stay on this device.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Pressing Read speaks that chapter with the voice already on this phone or computer. Nothing is sent to make the voice. Studio sends the line you chose, and only when you ask it to.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted">
          The site and the installed app are the same reader. Putting Injeel on a home screen does not collect anything more.
        </p>
      </div>
    </main>
  );
}
