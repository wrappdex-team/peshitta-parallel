/** Accept only the canonical positive integer spelling of a catalogued chapter. */
export function parseReaderChapter(chapter: string, chapterLimit: number): number | null {
  if (!Number.isSafeInteger(chapterLimit) || chapterLimit < 1 || !/^[1-9][0-9]*$/.test(chapter)) {
    return null;
  }
  const number = Number(chapter);
  return Number.isSafeInteger(number) && number <= chapterLimit ? number : null;
}
