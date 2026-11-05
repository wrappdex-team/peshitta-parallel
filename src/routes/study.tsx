import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_ORIGIN } from "@/lib/site";

export const Route = createFileRoute("/study")({
  head: () => ({
    meta: [
      { title: "About this Injeel — Injeel" },
      {
        name: "description",
        content:
          "Why this book carries the spirit of Y'shua, kept by the first churches and read today from the Peshitta.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/study` }],
  }),
  component: Study,
});

function Study() {
  return (
    <main className="mx-auto min-h-app max-w-3xl bg-paper px-5 pt-safe pb-page text-ink">
      <div className="pt-6">
        <Link to="/" className="inline-flex min-h-11 items-center text-garnet">
          All books
        </Link>
        <p className="mt-6 font-syriac text-4xl text-syriac" lang="syr" dir="rtl">
          ܐܘܢܓܠܝܘܢ
        </p>
        <p className="mt-3 text-xs tracking-widest text-gold">ABOUT THIS INJEEL</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">The book still has His breath in it</h1>
        <p className="mt-3 font-serif text-xl leading-snug text-garnet">
          The spirit of Y'shua, carried by the first churches, and set in the Peshitta so you can hear Him.
        </p>

        <div className="mt-8 space-y-4 text-base leading-relaxed">
          <p>Stop browsing. You opened the Injeel. Stay until He speaks.</p>
          <p>
            This is not a museum label and not a mood. The spirit in this book is a man. Y'shua the Mashiyach.
            The Word who was with Elohim. The Word who was Elohim. The Word who became flesh and dwelt among us.
            John wrote that while people who had seen Him were still alive. The churches did not invent it in a
            later century to win an argument. They were already bleeding for it.
          </p>
          <p>
            Read the red lines. Those are His. He does not talk like a mascot. He says, I am the way and the
            truth and the life. No one comes to my Father except by me. He says come, if you are tired, and He
            will give you rest. Then He walks into a city that wants Him dead, and He does not take the sentence
            back.
          </p>
        </div>

        <h2 className="mt-10 font-serif text-2xl">They had the glory right</h2>
        <div className="mt-3 space-y-4 text-base leading-relaxed">
          <p>
            Orthodox used to mean one thing. Right worship. The first-century churches worshipped Y'shua. They
            did not file Him under helpful teacher and go home. They immersed in the name of the Father and of
            the Son and of the Ruach haKodesh. They broke bread because He had told them to remember a body
            broken and a blood poured out. They called Him Master after the tomb, not only before it.
          </p>
          <p>
            Those believers translated. Aramaic was in His mouth and in the mouths of the apostles. Greek was
            the street. Syriac was the road east. They refused to leave the Mashiyach in one dialect and a locked
            room. A village that would never see Galilee still had to hear the same Lord. So the first churches
            carried Him across tongues on purpose. Same confession. Same cross. Same morning.
          </p>
          <p>
            That is the spirit of this book. Not a vibe we added in the margins. The spirit of the men and women
            who would not swap Y'shua for a safer name.
          </p>
        </div>

        <h2 className="mt-10 font-serif text-2xl">Then the Peshitta</h2>
        <div className="mt-3 space-y-4 text-base leading-relaxed">
          <p>
            Peshitta means straight. Simple. A text spread out so a congregation can stand up and read it aloud
            without getting lost. Later hands took the witness of those first churches and set it in the Syriac
            the churches of the East have read ever since. That later work did not drain the spirit out. It is
            how the spirit reached you.
          </p>
          <p>
            Without that translation, the words stay in a century you cannot enter. With it, you can sit down
            tonight and read what they refused to sand down. The Syriac on the page is that text. The English
            beside it is how we say the same words now. Y'shua. Maryam. Keefa. Elohim. Mashiyach. Not a costume.
            The names as they were carried.
          </p>
          <p>
            The old Peshitta collection held the Gospels, the Acts, Paul, and the letters the first Syriac
            churches already read. Five books were brought into Syriac afterward, and this reader marks them.
            Do not get distracted by that. The gospel was not waiting on a later appendix. Death is in Matthew.
            The empty tomb is in Matthew. Thomas puts his hand out and says, My Master and my Elohim. The spirit
            you came for is already on the page.
          </p>
        </div>

        <h2 className="mt-10 font-serif text-2xl">To you who love Isa</h2>
        <div className="mt-3 space-y-4 text-base leading-relaxed">
          <p>
            If you were raised Muslim, I am talking to you with respect. You were taught that the Injeel was
            given to Isa. You were taught to honor him and his mother Maryam. I am not asking you to curse your
            family or burn your life down for a slogan. I am asking you to open the book you were told existed.
          </p>
          <p>
            Not a speech about the book. The book. Read what He said with His own mouth. Read what they did to
            Him. Read the evening of the first day of the week, doors shut, fear in the room, and Y'shua standing
            there anyway. Peace be with you. If He is only a prophet, these pages will not hold. If He is the
            Lord, you will know it before anyone argues you into it.
          </p>
          <p>
            Come in. There is room in this movement for you. Not as a trophy. As a brother. As a sister. The
            first churches were already a crowd of nations. You are not late.
          </p>
        </div>

        <h2 className="mt-10 font-serif text-2xl">Do it</h2>
        <div className="mt-3 space-y-4 text-base leading-relaxed">
          <p>
            Here is the decision. Believe the Mashiyach these pages preach. Be immersed in the name He gave. Keep
            what He commanded. Then tell one other person that the tomb did not keep Him. That is the movement.
            It is not a comment. It is a life.
          </p>
          <p>He already said the sentence for the tired. Come to me. I will give you rest.</p>
        </div>

        <nav className="mt-8 flex flex-col gap-1 border-t border-line pt-4">
          <Link to="/read/$book/$chapter" params={{ book: "john", chapter: "1" }} className="inline-flex min-h-11 items-center text-garnet">
            Open John 1
          </Link>
          <Link to="/read/$book/$chapter" params={{ book: "john", chapter: "20" }} className="inline-flex min-h-11 items-center text-garnet">
            Open the morning the doors were shut
          </Link>
          <Link to="/read/$book/$chapter" params={{ book: "matthew", chapter: "28" }} className="inline-flex min-h-11 items-center text-garnet">
            Open the empty tomb
          </Link>
        </nav>
      </div>
    </main>
  );
}
