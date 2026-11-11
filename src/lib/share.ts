/** The host that answers without a redirect, so a social card can attach. */
export const SHARE_ORIGIN = "https://www.injeel.news";

export const APP_SHARE = {
  title: "Injeel — the words of Y'shua, kept",
  text: "The Good News was kept in Syriac, the language the old churches read. These are the words of Y'shua, still here. Read them, and pass them on.",
  url: `${SHARE_ORIGIN}/`,
};

export function verseShare(input: { bookName: string; book: string; chapter: number; verse: number; lines: string[] }) {
  const ref = `${input.bookName} ${input.chapter}:${input.verse}`;
  const lines = input.lines.map((line) => line.trim()).filter(Boolean);
  const text = [`${ref}`, ...lines, "", "These words were kept so they could be sent on."].join("\n");
  return {
    title: `${ref} — Injeel`,
    text,
    url: `${SHARE_ORIGIN}/read/${input.book}/${input.chapter}#v-${input.verse}`,
  };
}

export async function shareCard(card: { title: string; text: string; url: string }) {
  const nav = typeof navigator === "undefined" ? null : navigator;
  if (nav && typeof nav.share === "function") {
    try {
      await nav.share({ title: card.title, text: card.text, url: card.url });
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "closed" as const;
    }
  }
  try {
    await nav?.clipboard.writeText(`${card.text}\n${card.url}`);
    return "copied" as const;
  } catch {
    return "failed" as const;
  }
}
