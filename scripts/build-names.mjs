import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const lex = JSON.parse(readFileSync("src/data/lexicon.json", "utf8"));
const old = JSON.parse(execSync("git show HEAD:src/data/names.json", { encoding: "utf8" })).names;
const PREFIXES = ["ܘܕܒ", "ܘܕܠ", "ܘܒܕ", "ܘܕ", "ܘܒ", "ܘܠ", "ܕܒ", "ܕܠ", "ܘ", "ܕ", "ܒ", "ܠ"];
const PLACES = new Set(
  "Adramyttium Alexandria Amphipolis Antioch Assos Athens Babylon Berea Bethany Caesarea Cana Chios Cilicia Clauda Cnidus Crete Cyprus Cyrene Emmaus Ephesus Ephraim Euphrates Gabbatha Galila Gethsemane Golgotha Iconium Idumaea Italy Jericho Joppa Kfar-Nachum Laodicea Lystra Macedonia Megiddo Miletus Mitsrayin Mysia Nain Natsrath Paphos Patmos Perga Phoenicia Phoenix Pontus Ramah Rhoma Salem Salim Salmone Shamrayin Sinai Sodom Sychar Syria Tarsus Thessalonica Thyatira Tiberias Troas Tyre Urishlim Yehud Yordanan Zion Forum".split(
    " ",
  ),
);
const SKIP_GLOSS = new Set(
  "I Word Gentiles Pharisee Sabbath Master Rabbi Amen Spirit Father Son Lamb Passover Romans Hebrews Ephesians Galatians Philippians Corinthians Sadducees Stoics Magi Athenians Galileans Hellenists Samaritans Ninevites Yisraelites Parthians Most High Straight Legion Kristyana Wormwood Sheol Satana Elohim Mashiyach Master YHWH Alexandrian Augustan Canaanite Samaritan Gentile Typhonic".split(
    " ",
  ),
);
const NOT_A_NAME = new Set(
  "The And For From This That When Then There His Her Him Who What Which Not But All Any God Lord Holy One You He She They We My Our Your If Do Go Come Take See Let Have Are Is Was Be No Yes How Why Where So Now Also Show Stone Request Bring Hear Make Give Tell Ask Leave Stay Rise Send Stand Watch Remember Prepare Call Move Turn Bind Loose".split(
    " ",
  ),
);

function stemOf(word) {
  let stem = word.replace(/[܀-܍.,:;]/g, "");
  for (const pre of PREFIXES) {
    if (stem.startsWith(pre) && stem.length - pre.length >= 2) {
      stem = stem.slice(pre.length);
      break;
    }
  }
  return stem;
}

function fold(value) {
  return String(value)
    .toLowerCase()
    .replace(/['’\-]/g, "")
    .replace(/[āă]/g, "a")
    .replace(/[ēĕ]/g, "e")
    .replace(/[īĭ]/g, "i")
    .replace(/[ōŏ]/g, "o")
    .replace(/[ūŭ]/g, "u")
    .replace(/[ḥṭṣḍ]/g, (mark) => ({ ḥ: "h", ṭ: "t", ṣ: "s", ḍ: "d" })[mark])
    .replace(/[ʿʾ]/g, "");
}

function dist(a, b) {
  const left = fold(a);
  const right = fold(b);
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let prev = i;
    for (let j = 1; j <= right.length; j++) {
      const next = left[i - 1] === right[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev);
      row[j - 1] = prev;
      prev = next;
    }
    row[right.length] = prev;
  }
  return row[right.length];
}

function closeEnough(token, roman, gloss) {
  const best = Math.min(dist(token, roman || token), dist(token, gloss || token));
  const size = Math.max(fold(token).length, 1);
  return best <= 2 || best / size <= 0.34;
}

const books = [];
for (const file of readdirSync("src/data/nt").filter((item) => item.endsWith(".json")).sort()) {
  books.push(JSON.parse(readFileSync(`src/data/nt/${file}`, "utf8")));
}
const verses = [];
for (const book of books) {
  book.chapters.forEach((chapter, index) => {
    for (const verse of chapter) {
      const tokens = [];
      const text = verse.en || "";
      for (const match of text.matchAll(/\b[A-Z][A-Za-z'’-]*[A-Za-z]\b/g)) {
        if (!NOT_A_NAME.has(match[0])) tokens.push(match[0]);
      }
      verses.push({
        book: book.id,
        chapter: index + 1,
        verse: verse.v,
        tokens,
        syWords: new Set((verse.sy || "").split(/\s+/).map(stemOf).filter(Boolean)),
      });
    }
  });
}

const oldBySy = new Map(old.map((row) => [row.sy, row]));
const stems = [];
for (const [sy, row] of Object.entries(lex)) {
  const gloss = String(row.g || "").trim();
  if (!/^[A-Z]/.test(gloss) || gloss.startsWith("I ") || gloss.startsWith("O ") || SKIP_GLOSS.has(gloss)) continue;
  if (gloss.split(/\s+/).length > 2) continue;
  stems.push({ sy, gloss, say: String(row.r || "").trim(), note: String(row.n || "").trim() });
}

const owned = new Set(stems.map((stem) => fold(stem.say)).filter(Boolean));
const rows = [];
for (const stem of stems) {
  const hits = verses.filter((verse) => verse.syWords.has(stem.sy));
  if (!hits.length) continue;
  const counts = new Map();
  for (const verse of hits) for (const token of verse.tokens) counts.set(token, (counts.get(token) || 0) + 1);
  let en = "";
  let best = Infinity;
  let bestCount = 0;
  const sayFold = fold(stem.say || "");
  for (const [token, count] of counts) {
    const gap = dist(token, stem.say || token);
    const limit = sayFold.length >= 6 ? 3 : 2;
    if (gap > limit) continue;
    if (gap > 0 && owned.has(fold(token)) && fold(token) !== sayFold) continue;
    if (gap < best || (gap === best && count > bestCount)) {
      best = gap;
      bestCount = count;
      en = token;
    }
  }
  const prior = oldBySy.get(stem.sy);
  if (!en) en = prior?.en || "";
  if (!en || NOT_A_NAME.has(en)) continue;
  const known = prior?.known || (stem.gloss !== en ? stem.gloss : en);
  const kind = prior?.kind || (PLACES.has(stem.gloss) || PLACES.has(known) || PLACES.has(en) ? "place" : "person");
  const say = stem.say || en;
  const readingClose = closeEnough(en, say, en) || closeEnough(known, say, known);
  const familiar = known !== en ? ` The familiar English is ${known}.` : "";
  const reading = readingClose ? ` Read from the Syriac letters: ${say}.` : say ? ` A reading of this Syriac stem is ${say}.` : "";
  const written = stem.note
    ? stem.note
    : `The Peshitta writes this ${kind} ${stem.sy}. This book prints ${en}.${familiar}${reading}`;
  const forms = [
    ...new Set([
      en,
      ...[...counts.keys()].filter((token) => {
        if (NOT_A_NAME.has(token) || dist(token, stem.say || token) > 1) return false;
        return fold(token) === sayFold || !owned.has(fold(token));
      }),
    ]),
  ];
  rows.push({
    sy: stem.sy,
    en,
    forms,
    known,
    say,
    kind,
    count: hits.length,
    ref: `${hits[0].book} ${hits[0].chapter}:${hits[0].verse}`,
    note: written,
  });
}

const used = new Set();
for (const row of rows.sort((a, b) => a.en.localeCompare(b.en, "en") || a.sy.localeCompare(b.sy))) {
  let id = fold(row.en).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "name";
  if (used.has(id)) id = `${id}-${fold(row.say).slice(0, 8) || rows.indexOf(row)}`;
  let n = 2;
  while (used.has(id)) id = `${id}-${n++}`;
  used.add(id);
  row.id = id;
}

console.log("names", rows.length, "from the book", rows.filter((row) => row.en !== row.known).length, "same as familiar", rows.filter((row) => row.en === row.known).length);
console.log(rows.filter((row) => row.en !== row.known).slice(0, 35).map((row) => `${row.en}  ←  ${row.known}  ·  ${row.say}`).join("\n"));
if (process.argv.includes("--write")) {
  writeFileSync(
    "src/data/names.json",
    JSON.stringify(
      {
        note: "Persons and places in this Peshitta. sy is the spelling in the text. en is the form printed in this book. known is the familiar English finder. say is a reading of the Syriac letters, not a second translation.",
        names: rows,
      },
      null,
      2,
    ) + "\n",
  );
}
