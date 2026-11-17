/** Lazy per-chapter word files and per-book lemma shards. One chunk each. */
export const wordChapterFiles = import.meta.glob("../data/words/*/*.json", {
  import: "default",
}) as Record<string, () => Promise<unknown>>;

export const lemmaFiles = import.meta.glob("../data/words/lemmas/*.json", {
  import: "default",
}) as Record<string, () => Promise<unknown>>;
