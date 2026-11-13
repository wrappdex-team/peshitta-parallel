/** Gospel completion and the declaration kept on this device. */

export const GOSPEL_CHAPTERS = {
  matthew: 28,
  mark: 16,
  luke: 24,
  john: 21,
} as const;

export const GOSPEL_IDS = ["matthew", "mark", "luke", "john"] as const;

/** The name he was called, in the square letters of the first century. */
export const NAME_HEBREW = "ישוע";

export const DECLARATION = [
  "I have read the four Gospels kept in this Injeel.",
  "I declare that the words kept in this book are true.",
  "I declare that Y'shua the Mashiyach is YHWH, God who became man. The Word who was with Elohim, and the Word who was Elohim, and the Word who became flesh and dwelt among us.",
  "I declare that he died, that the tomb did not keep him, and that he is Master.",
  "I receive the gift of grace. I am a vessel of that gift, the Ruach haKodesh, the Holy Spirit.",
  "These words are his. I have read them. I say they are true.",
] as const;

const KEY = "injeel-declaration";

export type Declaration = {
  kept: boolean;
  name: string;
  date: string;
  dismissed: boolean;
};

export const EMPTY_DECLARATION: Declaration = { kept: false, name: "", date: "", dismissed: false };

export function gospelTotals() {
  return GOSPEL_IDS.reduce((sum, id) => sum + GOSPEL_CHAPTERS[id], 0);
}

export function gospelProgress(counts: Record<string, number>) {
  let done = 0;
  const of = gospelTotals();
  for (const id of GOSPEL_IDS) {
    const chapters = GOSPEL_CHAPTERS[id];
    for (let chapter = 1; chapter <= chapters; chapter++) {
      if ((counts[`${id}:${chapter}`] ?? 0) > 0) done += 1;
    }
  }
  return { of, done, remain: of - done, complete: of > 0 && done === of };
}

export function nextGospelChapter(counts: Record<string, number>) {
  for (const id of GOSPEL_IDS) {
    const chapters = GOSPEL_CHAPTERS[id];
    for (let chapter = 1; chapter <= chapters; chapter++) {
      if ((counts[`${id}:${chapter}`] ?? 0) <= 0) return { book: id, chapter };
    }
  }
  return null;
}

export function clampName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function todayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function longDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function readDeclaration(): Declaration {
  if (typeof localStorage === "undefined") return EMPTY_DECLARATION;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Declaration>;
    return {
      kept: raw.kept === true,
      name: typeof raw.name === "string" ? clampName(raw.name) : "",
      date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : "",
      dismissed: raw.dismissed === true,
    };
  } catch {
    return EMPTY_DECLARATION;
  }
}

function writeDeclaration(next: Declaration) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("injeel-declaration"));
  return next;
}

export function keepDeclaration(name: string, date = todayIso()) {
  const current = readDeclaration();
  return writeDeclaration({
    kept: true,
    name: clampName(name),
    date: current.date || date,
    dismissed: true,
  });
}

export function dismissDeclaration() {
  const current = readDeclaration();
  if (current.kept) return current;
  return writeDeclaration({ ...current, dismissed: true });
}

export function declarationShareText(name: string, date: string) {
  const lines: string[] = [...DECLARATION];
  const signed = clampName(name);
  if (signed) lines.push("", `Signed, ${signed}`);
  if (date) lines.push(longDate(date));
  return lines.join("\n");
}
