import { createServerFn } from "@tanstack/react-start";

/** Verse lists for the names page. The pack stays on the server; the page receives it as loader data. */
export const loadNameVersePack = createServerFn({ method: "GET" }).handler(async () => {
  const { NAME_VERSE_PACK } = await import("./name-verse-pack");
  return NAME_VERSE_PACK;
});
