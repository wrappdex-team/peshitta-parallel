import { createFileRoute, Link } from "@tanstack/react-router";
import { GUIDE } from "@/lib/guide";
import { SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Guide — Injeel" },
      {
        name: "description",
        content: "How to use the Injeel reader: the text, the page, search, names, read aloud, and what stays on this device.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/guide` }],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <main className="min-h-app bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-5 pt-safe pb-page">
        <div className="pt-6">
          <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
            All books
          </Link>
          <p className="mt-6 text-xs tracking-widest text-gold">GUIDE</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">How to use this reader</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed">
            Each section names a control as it is labeled on the page, and says what that control does. This is not a reading of the book. About this Injeel is the essay.
          </p>
        </div>

        <div className="mt-8 md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-12">
          <nav aria-label="Guide contents" className="md:sticky md:top-6 md:self-start">
            <p className="text-xs tracking-widest text-gold">CONTENTS</p>
            <ol className="mt-2 border-t border-line">
              {GUIDE.map((section, index) => (
                <li key={section.id} className="border-b border-line">
                  <Link
                    to="/guide"
                    hash={section.id}
                    className="flex min-h-11 items-baseline gap-3 py-2 text-sm"
                  >
                    <span className="w-6 shrink-0 tabular-nums text-muted">{index + 1}</span>
                    <span>{section.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 md:mt-0">
            {GUIDE.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-6 border-t border-line py-8 first:border-t-0 first:pt-0">
                <p className="text-xs tracking-widest text-gold">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-1 font-serif text-3xl">{section.title}</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed">{section.lead}</p>
                {section.rows && (
                  <dl className="mt-5 border-t border-line">
                    {section.rows.map((row) => (
                      <div key={row.term} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
                        <dt className="font-serif text-lg">
                          {row.to ? (
                            <Link to={row.to} className="text-garnet">
                              {row.term}
                            </Link>
                          ) : (
                            row.term
                          )}
                        </dt>
                        <dd className="text-base leading-relaxed text-muted">{row.text}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {section.notes && (
                  <div className="mt-4 max-w-2xl space-y-3 text-base leading-relaxed">
                    {section.notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
