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
          Read uses your browser’s speech service without a provider key. Voices, languages and accents depend on the browser and operating system; some voices use network services. Installing a system voice does not guarantee the browser can use it. Open Voice setup help beside the player for device instructions.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Studio is optional. Requested passages, prompts and your supplied provider key pass through this server to the selected provider. Paid keys may be charged. Free-tier keys still have the provider’s own limits, and that provider may keep the prompt. A timeout, closing Studio or disconnecting a key does not guarantee cancellation or prevent provider charges; check your provider before submitting again.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Studio Save uses tab-session storage, not persistent key storage. Refresh normally retains the key; browser restore or duplicate-tab behavior may preserve or copy it. Scripts running on this origin can access session data: it is not an encrypted vault or XSS protection. Clear disconnects the active key and attempts removal; blocked storage can prevent deletion. Old device-saved keys are removed without being read or copied, so you may need to re-enter yours. Reading settings and progress remain in local storage.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          The page also loads a Grok platform extension script. Session-only storage reduces retention but does not isolate an in-use key from page scripts. Use provider account limits and only a key you are comfortable supplying to this service.
        </p>
        <p className="mt-4 text-base leading-relaxed">
          Corner asks this device to keep the screen awake and can show a player card. That stays on the phone. It is not sent to Injeel.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted">
          The site and the installed app are the same reader. Putting Injeel on a home screen does not collect anything more.
        </p>
      </div>
    </main>
  );
}
