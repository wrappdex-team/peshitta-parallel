import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const lex = JSON.parse(readFileSync("src/data/lexicon.json", "utf8"));
const old = JSON.parse(execSync("git show HEAD:src/data/names.json", { encoding: "utf8" })).names;
const SINGLE = ["ܘ", "ܕ", "ܒ", "ܠ"];

function stemCandidates(word) {
  const bare = String(word).replace(/[܀-܍.,:;\u0730-\u074A]/g, "");
  if (bare.length < 2) return [];
  const keys = new Set([bare]);
  for (const pre of SINGLE) {
    if (!bare.startsWith(pre) || bare.length - 1 < 2) continue;
    const rest = bare.slice(1);
    keys.add(rest);
    for (const next of SINGLE) {
      if (rest.startsWith(next) && rest.length - 1 >= 3) keys.add(rest.slice(1));
    }
  }
  return [...keys];
}

function stemOf(word) {
  const bare = String(word).replace(/[܀-܍.,:;\u0730-\u074A]/g, "");
  for (const pre of SINGLE) {
    if (bare.startsWith(pre) && bare.length - 1 >= 3) return bare.slice(1);
  }
  return bare;
}
const PLACES = new Set(
  "Adramyttium Alexandria Amphipolis Antioch Assos Athens Babylon Berea Bethany Caesarea Cana Chios Cilicia Clauda Cnidus Crete Cyprus Cyrene Emmaus Ephesus Ephraim Euphrates Gabbatha Gadarenes Galila Gethsemane Golgotha Iconium Idumaea Italy Jericho Joppa Kfar-Nachum Laodicea Lystra Macedonia Megiddo Miletus Mitsrayin Mysia Nain Natsrath Paphos Patmos Perga Phoenicia Phoenix Pontus Ramah Rhoma Salem Salim Salmone Shamrayin Sinai Sodom Sychar Syria Tarsus Thessalonica Thyatira Tiberias Troas Tyre Urishlim Yehud Yordanan Zion Forum Darmasuq Damascus Tsidon Sidon Achaia Asia Gehenna Sheol Beth-Lekhem Bethlehem Beth-Tsayda Bethsaida Galatia Pamphylia Phrygia Bithynia Philadelphia Spain Arabia Sardis Lud Lydda Charan Haran Kenaan Canaan Gennesar Gennesaret Shiloach Siloam Beth-Paga Bethphage Beth-Nahrin Nineveh Shalem Corinth Qorinthos Caesarea Antiokia Antiyokya Antiokiya Akaya Alexandria Cyrene Lystra Derbe Smyrna Pergamos Tsiyon Tsehyon Surya Italiya Qupros Suf Yericho Iriycho Airikhu Libya Gaza Melita Philippi Laodikeia Dalmatya Tsarfat Korazin Abilene Ituraea Trachonitis Pisidia Pisidiya Azotus Saron Midian Qedron Magdala Dalmanutha Beth-Chesda Qenkreos Qenkraus Nikopolis Seluqia Neapolis Apollonia Mitylene Patara Akko Antipatris Myra Lycia Syrtis Samothrace Hellas Samos Rodos Putiyalis Regiyun Lycaonia Attalia Salmina Trogyllium Cappadocia Cappadocians".split(
    " ",
  ),
);
const SKIP_GLOSS = new Set(
  "I Word Gentiles Pharisee Sabbath Master Rabbi Amen Spirit Father Son Lamb Passover Romans Hebrews Ephesians Galatians Philippians Corinthians Sadducees Stoics Magi Athenians Galileans Hellenists Samaritans Ninevites Yisraelites Parthians Most High Straight Legion Kristyana Wormwood Elohim Mashiyach Master YHWH Alexandrian Augustan Canaanite Samaritan Gentile Typhonic".split(
    " ",
  ),
);
const NOT_A_NAME = new Set(
  "The And For From This That When Then There His Her Him Who What Which Not But All Any God Lord Holy One You He She They We My Our Your If Do Go Come Take See Let Have Are Is Was Be No Yes How Why Where So Now Also Show Stone Request Bring Hear Make Give Tell Ask Leave Stay Rise Send Stand Watch Remember Prepare Call Move Turn Bind Loose Am Look Blessed Truly Woe Greet Therefore Because It Or These Why Who Whoever Our Let From How In Be Are As Come When By Yes Where Yet After Your All One Not Everyone His Get Far Every Again Here Does She Those Make Tell Which On Watch High Just Can Thus Leave Has Shall Today First King Neither Sit Well Ask Woman Bring Until Stand Was Whose Only May Turn Know Will Others Show Two Last Already Someone Keep Much Whatever Some Could Another".split(
    " ",
  ),
);

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

function bareWord(word) {
  return String(word).replace(/[܀-܍.,:;\u0730-\u074A]/g, "");
}

const ROM = {
  "ܐ": "a", "ܒ": "b", "ܓ": "g", "ܕ": "d", "ܗ": "h", "ܘ": "w", "ܙ": "z", "ܚ": "h",
  "ܛ": "t", "ܝ": "y", "ܟ": "k", "ܠ": "l", "ܡ": "m", "ܢ": "n", "ܣ": "s", "ܥ": "a",
  "ܦ": "p", "ܨ": "s", "ܩ": "q", "ܪ": "r", "ܫ": "sh", "ܬ": "t",
};

function romansOf(sy) {
  let base = "";
  for (const ch of sy) if (ROM[ch]) base += ROM[ch];
  const out = new Set([base, base.replace(/w/g, "u").replace(/y/g, "i"), base.replace(/w/g, "v"), base.replace(/a/g, "")]);
  if (sy.includes("ܨ")) out.add(base.replace(/s/g, "ts"));
  return [...out].filter(Boolean);
}

function bestDist(token, sy) {
  const options = romansOf(sy);
  if (!options.length) return 99;
  return Math.min(...options.map((roman) => dist(token, roman)));
}

const PEOPLES = new Set(
  "Yehudaye Yehudi Yehudaya Yehudeans Natsraya Samaritans Samaritan Sadducees Galileans Aramean Aramaye Magi Magushi Nicolaitans Athenians Macedonian Macedonians".split(" "),
);
const SKIP_HARVEST = new Set(
  "Elohim Mashiyach Ruach Rabbi Life-Giver Yehudaye Yehudi Natsraya Aramean Aramaye Immerser Hebrew Greek Honor Humble Girl Worship Shabbat Torah Hosanna Hallelujah Pentecost Calumniator Judaism Athenians Galileans Nicolaitans Yawnaye Pagos Macedonian Macedonians Egyptian Samaritan Yehudeans Roman Levite Levites Galilayan Shomraye Armaye Zaduqaye Prisha Prishe Magi Magushi Zealot Psalms Beautiful True Faithful Concerning Beloved Others Two Three Seven Ten Crucify Repent Beware Servants Stretch Prophesy Holder Flee Pursue Someone Fool Fools Joy Guard Release Hearing Wives Husbands Cast Majesty Blessing Draw Search Gather Untie Produce Shut Consider Depart Salt Were Fall Sleep Praise Animals Elders Deliverance Fallen Whatever Offspring Creator Comforter Skull Tend Twin Hypocrite An Bar Olives Father's Elohim's Mashiyachs".split(" "),
);

const FAMILIAR = {
  Darmasuq: "Damascus",
  Tsidon: "Sidon",
  Achaia: "Achaia",
  Asia: "Asia",
  Gehenna: "Gehenna",
  Sheol: "Sheol",
  Satana: "Satan",
  Aharon: "Aaron",
  Levi: "Levi",
  Luqa: "Luke",
  "Beth-Lekhem": "Bethlehem",
  "Beth-Tsayda": "Bethsaida",
  "Beth-Paga": "Bethphage",
  "Beth-Nahrin": "Mesopotamia",
  Galatia: "Galatia",
  Pamphylia: "Pamphylia",
  Phrygia: "Phrygia",
  Bithynia: "Bithynia",
  Philadelphia: "Philadelphia",
  Spain: "Spain",
  Arabia: "Arabia",
  Sardis: "Sardis",
  Lud: "Lydda",
  Charan: "Haran",
  Kenaan: "Canaan",
  Gennesar: "Gennesaret",
  Shiloach: "Siloam",
  Nineveh: "Nineveh",
  Shalem: "Salem",
  Benyamin: "Benjamin",
  Zebulun: "Zebulun",
  Naphtali: "Naphtali",
  Yonah: "Jonah",
  Yona: "Jonah",
  Natsraya: "Nazarene",
  Yehudaye: "Jews",
  Yehudi: "Jew",
  Yehudaya: "Jew",
  Yehudeans: "Jews",
  Gadarenes: "Gadarenes",
  Samaritans: "Samaritans",
  Sadducees: "Sadducees",
  Galileans: "Galileans",
  Aramean: "Aramean",
  Aramaye: "Arameans",
  Magi: "Magi",
  Magushi: "Magi",
  Chanan: "Annas",
  "Malki-Zedek": "Melchizedek",
  Sosthenes: "Sosthenes",
  Aristarchus: "Aristarchus",
  Alexander: "Alexander",
  Demetrius: "Demetrius",
  Rufus: "Rufus",
  Nicolaitans: "Nicolaitans",
  Yonan: "Jonah",
  Daniyel: "Daniel",
  Balaam: "Balaam",
  Babil: "Babylon",
  Corinth: "Corinth",
  Qorinthos: "Corinth",
  Abba: "Abba",
  Stephanas: "Stephanas",
  Bernice: "Bernice",
  Theophilus: "Theophilus",
  Claudius: "Claudius",
  Lydia: "Lydia",
  Arkippos: "Archippus",
  Krispos: "Crispus",
  Sosthenes: "Sosthenes",
  Mathiya: "Matthias",
  Dema: "Demas",
  Chanan: "Annas",
  Ashir: "Asher",
  "Bar-Abba": "Barabbas",
  "Bar-Shuma": "Barsabbas",
  "Bar-Tulmay": "Bartholomew",
  Chalpai: "Alphaeus",
  Timai: "Timaeus",
  Qananya: "Canaanite",
  Zakki: "Zacchaeus",
  Suf: "the Red Sea",
  Yericho: "Jericho",
  Iriycho: "Jericho",
  Airikhu: "Jericho",
  Tiberias: "Tiberias",
  Phoenicia: "Phoenicia",
  Iconium: "Iconium",
  Cappadocia: "Cappadocia",
  Libya: "Libya",
  Gaza: "Gaza",
  Melita: "Malta",
  Philippi: "Philippi",
  Laodicea: "Laodicea",
  Laodikeia: "Laodicea",
  Dalmatya: "Dalmatia",
  Golgotha: "Golgotha",
  Gabbatha: "Gabbatha",
  Tsarfat: "Zarephath",
  Korazin: "Chorazin",
  Yonah: "Jonah",
  Yona: "Jonah",
  Yonan: "Jonah",
  Benyamin: "Benjamin",
  Bernice: "Bernice",
  Gad: "Gad",
  Rubil: "Reuben",
  Menashe: "Manasseh",
  Issachar: "Issachar",
  Alap: "Alpha",
  Tau: "Omega",
  Baal: "Baal",
  "Mikha'el": "Michael",
  Gog: "Gog",
  Magog: "Magog",
  Abaddon: "Abaddon",
  Yishai: "Jesse",
  Hoshea: "Hosea",
  Chanokh: "Enoch",
  Enoch: "Enoch",
  Iyov: "Job",
  Baraq: "Barak",
  Naftach: "Jephthah",
  Quirinius: "Quirinius",
  Tiberius: "Tiberius",
  Hanna: "Anna",
  Lamek: "Lamech",
  Eber: "Eber",
  Zarach: "Zerah",
  Uriya: "Uriah",
  Zurbavel: "Zerubbabel",
  Archelaus: "Archelaus",
  Stephanas: "Stephanas",
  Lois: "Lois",
  Junia: "Junia",
  Phoibe: "Phoebe",
  Clement: "Clement",
  Balak: "Balak",
  Qorach: "Korah",
  Barakhya: "Berechiah",
  Abilene: "Abilene",
  Ituraea: "Ituraea",
  Trachonitis: "Trachonitis",
  Pisidia: "Pisidia",
  Thessalonica: "Thessalonica",
  Azotus: "Azotus",
  Saron: "Sharon",
  Midian: "Midian",
  Qedron: "Kidron",
  Magdala: "Magdala",
  Dalmanutha: "Dalmanutha",
  "Beth-Chesda": "Bethesda",
  Qenkreos: "Cenchrea",
  Nikopolis: "Nicopolis",
  Adramyttium: "Adramyttium",
  Seluqia: "Seleucia",
  Neapolis: "Neapolis",
  Apollonia: "Apollonia",
  Mitylene: "Mitylene",
  Patara: "Patara",
  Akko: "Ptolemais",
  Antipatris: "Antipatris",
  Myra: "Myra",
  Lycia: "Lycia",
  Syrtis: "Syrtis",
  Samothrace: "Samothrace",
  Hellas: "Greece",
  Chios: "Chios",
  Samos: "Samos",
  Rodos: "Rhodes",
  Putiyalis: "Puteoli",
  Regiyun: "Rhegium",
  Lycaonia: "Lycaonia",
  Attalia: "Attalia",
  Salmina: "Salamis",
  Trogyllium: "Trogyllium",
  "Fanu'el": "Phanuel",
  Lysanias: "Lysanias",
  Shelatiel: "Shealtiel",
  Perets: "Perez",
  Pharets: "Perez",
  Shimshon: "Samson",
  "Gid'on": "Gideon",
  Shmuel: "Samuel",
  Yoel: "Joel",
  Beor: "Beor",
  Tamar: "Tamar",
  Rahab: "Rahab",
  Rut: "Ruth",
  Esau: "Esau",
  Hagar: "Hagar",
  Ishmael: "Ishmael",
  Qayin: "Cain",
  Habeel: "Abel",
  Hawwa: "Eve",
  Adam: "Adam",
  Noach: "Noah",
  Nuch: "Noah",
  Aphsiya: "Apphia",
  Demetrius: "Demetrius",
  Alexander: "Alexander",
  Lysias: "Lysias",
  Rufus: "Rufus",
  Nicolaitans: "Nicolaitans",
};

function studyNote(kind, sy, en, known, say, lexNote, gloss) {
  if (lexNote) return lexNote;
  const familiar = known && known !== en ? ` The familiar English is ${known}.` : "";
  const reading = say ? ` Read from the Syriac letters: ${say}.` : "";
  let written = `The Peshitta writes this ${kind} ${sy}. This book prints ${en}.${familiar}${reading}`;
  if (gloss && /^[a-z]/.test(gloss) && dist(en, gloss) > 2) written += ` The same letters are also the ordinary word “${gloss}.”`;
  return written;
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
        syWords: new Set((verse.sy || "").split(/\s+/).flatMap((word) => stemCandidates(word))),
        raw: (verse.sy || "").split(/\s+/).map(bareWord).filter((word) => word.length >= 2),
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
  const known = prior?.known || FAMILIAR[en] || (stem.gloss !== en ? stem.gloss : en);
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

const tokenCount = new Map();
for (const verse of verses) for (const token of verse.tokens) tokenCount.set(token, (tokenCount.get(token) || 0) + 1);
const bareFreq = new Map();
for (const verse of verses) for (const word of new Set(verse.raw)) bareFreq.set(word, (bareFreq.get(word) || 0) + 1);

function rowForSy(sy) {
  return rows.find((row) => row.sy === sy || row.sy === stemOf(sy) || stemOf(row.sy) === sy);
}

function addForm(row, token) {
  if (!token || NOT_A_NAME.has(token)) return;
  if (SKIP_HARVEST.has(token) && !PEOPLES.has(token)) return;
  if (!row.forms.includes(token)) row.forms.push(token);
}

function promote(row) {
  const before = row.en;
  let best = row.en;
  let bestN = tokenCount.get(row.en) || 0;
  for (const form of row.forms) {
    if (/'s$/.test(form) || form.includes(" ")) continue;
    const count = tokenCount.get(form) || 0;
    if (count > bestN) {
      best = form;
      bestN = count;
    }
  }
  row.en = best;
  if (!row.forms.includes(best)) row.forms.unshift(best);
  if (before !== best) row.note = row.note.replace(`This book prints ${before}.`, `This book prints ${best}.`);
}

const taken = new Set(rows.flatMap((row) => row.forms));

function versesOf(token) {
  return verses.filter((verse) => verse.tokens.includes(token));
}

function attachToken(token, sy) {
  const hits = versesOf(token).filter((verse) => verse.raw.includes(sy) || verse.syWords.has(sy) || verse.syWords.has(stemOf(sy)));
  if (!hits.length) return false;
  const row = rowForSy(sy);
  if (row) {
    addForm(row, token);
    return true;
  }
  return false;
}

for (const [token, sy] of [
  ["Noach", "ܢܘܚ"],
  ["Felix", "ܦܝܠܟܣ"],
  ["Antiokia", "ܐܢܛܝܟܝܐ"],
  ["Antiokiya", "ܐܢܛܝܟܝܐ"],
  ["Syria", "ܣܘܪܝܐ"],
  ["Tsiyon", "ܨܗܝܘܢ"],
  ["Caesar's", "ܩܣܪ"],
  ["Cyprus", "ܩܘܦܪܘܣ"],
  ["Italy", "ܐܝܛܠܝܐ"],
  ["Jason", "ܐܝܣܘܢ"],
  ["Gaius", "ܓܐܝܘܣ"],
  ["Herodias", "ܗܪܘܕܝܐ"],
  ["Habeel", "ܗܒܝܠ"],
  ["Silwanus", "ܣܠܘܢܘܣ"],
  ["Gallio", "ܓܐܠܝܘܢ"],
  ["Alexandria", "ܐܠܟܣܢܕܪܝܐ"],
  ["Miletus", "ܡܝܠܝܛܘܣ"],
  ["Cyrene", "ܩܘܪܝܢܐ"],
  ["Epaphras", "ܐܦܦܪܐ"],
  ["Lystra", "ܠܘܣܛܪܐ"],
  ["Caesarea", "ܩܝܣܪܝܐ"],
  ["Corinth", "ܩܘܪܢܬܘܣ"],
  ["Qorinthos", "ܩܘܪܢܬܘܣ"],
]) {
  if (taken.has(token)) continue;
  if (attachToken(token, sy)) taken.add(token);
}

function nameKeys(word) {
  return stemCandidates(word);
}

const stemFreq = new Map();
for (const verse of verses) {
  const keys = new Set();
  for (const word of verse.raw) for (const key of nameKeys(word)) keys.add(key);
  for (const key of keys) stemFreq.set(key, (stemFreq.get(key) || 0) + 1);
}

function readingOf(sy, token) {
  if (sy.includes(" ")) return token;
  const lexSay = (lex[sy]?.r || "").trim();
  if (lexSay && !/^d[-']/.test(lexSay) && bestDist(token, sy) <= 3) return lexSay;
  return token;
}

function addHarvested(token, sy, hits) {
  const parts = sy.split(" ");
  const existing = parts.length === 1 ? rowForSy(parts[0]) : rows.find((row) => row.sy === sy);
  const wantPlace = PLACES.has(token) || PLACES.has(FAMILIAR[token] || "");
  if (existing && !(wantPlace && existing.kind === "person")) {
    addForm(existing, token);
    taken.add(token);
    return;
  }
  const gloss = lex[sy]?.g || "";
  const say = readingOf(sy, token);
  const known = FAMILIAR[token] || (/^[A-Z]/.test(gloss) && dist(token, gloss) <= 3 ? gloss : token);
  const kind = PEOPLES.has(token) || PEOPLES.has(known) ? "people" : PLACES.has(token) || PLACES.has(known) || PLACES.has(gloss) ? "place" : "person";
  const lexNote = lex[sy]?.n || "";
  rows.push({
    sy,
    en: token,
    forms: [token],
    known,
    say,
    kind,
    count: hits.length,
    ref: `${hits[0].book} ${hits[0].chapter}:${hits[0].verse}`,
    note: studyNote(kind, sy, token, known, say, lexNote, gloss),
  });
  taken.add(token);
}

for (const [token, count] of tokenCount) {
  if (taken.has(token) || NOT_A_NAME.has(token) || SKIP_HARVEST.has(token)) continue;
  if (token.endsWith("'s") || token.length < 3) continue;
  const hits = versesOf(token);
  const scored = new Map();
  for (const verse of hits) {
    const keys = new Set();
    for (const word of verse.raw) for (const key of nameKeys(word)) keys.add(key);
    for (const key of keys) scored.set(key, (scored.get(key) || 0) + 1);
  }
  let best = null;
  for (const [sy, seen] of scored) {
    const cover = seen / hits.length;
    const freq = stemFreq.get(sy) || seen;
    if (sy.length < 2) continue;
    const gap = bestDist(token, sy);
    if (sy.length < 3 && gap > 0) continue;
    const limit = fold(token).length >= 6 ? 3 : 2;
    if (gap > limit) continue;
    if (cover < 0.8 && !(gap <= 1 && cover >= 0.66)) continue;
    if (freq > Math.max(count * 2.5, count + 8) && gap > 1) continue;
    if (count === 1 && !(gap <= 1 && freq <= count + 3)) continue;
    if (!best || gap < best.gap || (gap === best.gap && seen > best.seen)) best = { sy, gap, seen, freq };
  }
  if (token.includes("-")) {
    const right = token.split("-").slice(1).join("-");
    const pairs = new Map();
    for (const verse of hits) {
      const words = verse.raw;
      for (let i = 0; i < words.length - 1; i++) {
        const head = words[i];
        const tail = nameKeys(words[i + 1]).sort((a, b) => bestDist(right, a) - bestDist(right, b))[0];
        const headOk = head === "ܒܝܬ" || head.endsWith("ܒܝܬ") || head === "ܒܪ" || (head.endsWith("ܒܪ") && head.length <= 4);
        if (!headOk || !tail || bestDist(right, tail) > 3) continue;
        const key = `${head.endsWith("ܒܝܬ") ? "ܒܝܬ" : "ܒܪ"} ${tail}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
    const pair = [...pairs.entries()].sort((a, b) => b[1] - a[1])[0];
    if (pair && pair[1] >= Math.max(2, Math.ceil(hits.length * 0.6))) best = { sy: pair[0], gap: 0, seen: pair[1], freq: pair[1] };
  }
  if (best) addHarvested(token, best.sy, hits);
}

const HAND = [
  ["Darmasuq", "ܕܪܡܣܘܩ"],
  ["Tsidon", "ܨܝܕܢ"],
  ["Achaia", "ܐܟܐܝܐ"],
  ["Asia", "ܐܣܝܐ"],
  ["Gehenna", "ܓܗܢܐ"],
  ["Levi", "ܠܘܝ"],
  ["Luqa", "ܠܘܩܐ"],
  ["Abba", "ܐܒܐ"],
  ["Beth-Lekhem", "ܒܝܬ ܠܚܡ"],
  ["Galatia", "ܓܠܛܝܐ"],
  ["Sardis", "ܣܪܕܝܣ"],
  ["Spain", "ܐܣܦܢܝܐ"],
  ["Corinth", "ܩܘܪܢܬܘܣ"],
  ["Qorinthos", "ܩܘܪܢܬܘܣ"],
  ["Caesarea", "ܩܣܪܝܐ"],
  ["Pamphylia", "ܦܡܦܘܠܝܐ"],
  ["Phrygia", "ܦܪܘܓܝܐ"],
  ["Bithynia", "ܒܝܬܘܢܝܐ"],
  ["Philadelphia", "ܦܝܠܕܠܦܝܐ"],
  ["Arabia", "ܐܪܒܝܐ"],
  ["Daniyel", "ܕܢܝܐܝܠ"],
  ["Bernice", "ܒܪܢܝܩܐ"],
  ["Theophilus", "ܬܐܘܦܝܠܐ"],
  ["Benyamin", "ܒܢܝܡܝܢ"],
  ["Naphtali", "ܢܦܬܠܝ"],
  ["Gennesar", "ܓܢܣܪ"],
  ["Shiloach", "ܫܝܠܘܚܐ"],
  ["Nineveh", "ܢܝܢܘܝܐ"],
  ["Derbe", "ܕܪܒܐ"],
  ["Smyrna", "ܙܡܘܪܢܐ"],
  ["Pergamos", "ܦܪܓܡܘܣ"],
  ["Aharon", "ܐܗܪܘܢ"],
  ["Zebulun", "ܙܒܘܠܘܢ"],
  ["Kenaan", "ܟܢܥܢ"],
  ["Charan", "ܚܪܢ"],
  ["Lud", "ܠܘܕ"],
  ["Yonah", "ܝܘܢܐ"],
  ["Yona", "ܝܘܢܐ"],
  ["Benyamin", "ܒܢܝܡܝܢ"],
  ["Bernice", "ܒܪܢܝܩܐ"],
  ["Gad", "ܓܕ"],
  ["Rubil", "ܪܘܒܝܠ"],
  ["Menashe", "ܡܢܫܐ"],
  ["Issachar", "ܐܝܣܟܪ"],
  ["Tau", "ܬܘ"],
  ["Alap", "ܐܠܦ"],
  ["Baal", "ܒܥܠܐ"],
  ["Mikha'el", "ܡܝܟܐܝܠ"],
  ["Gog", "ܓܘܓ"],
  ["Magog", "ܡܓܘܓ"],
  ["Abaddon", "ܥܒܕܘ"],
  ["Yishai", "ܐܝܫܝ"],
  ["Hoshea", "ܗܘܫܥ"],
  ["Chanokh", "ܚܢܘܟ"],
  ["Enoch", "ܚܢܘܟ"],
  ["Iyov", "ܐܝܘܒ"],
  ["Baraq", "ܒܪܩ"],
  ["Naftach", "ܢܦܬܚ"],
  ["Shimshon", "ܫܡܫܘܢ"],
  ["Gid'on", "ܓܕܥܘܢ"],
  ["Shmuel", "ܫܡܘܐܝܠ"],
  ["Quirinius", "ܩܘܪܝܢܘܣ"],
  ["Tiberius", "ܛܝܒܪܝܘܣ"],
  ["Hanna", "ܚܢܐ"],
  ["Lamek", "ܠܡܟ"],
  ["Eber", "ܥܒܪ"],
  ["Zarach", "ܙܪܚ"],
  ["Uriya", "ܐܘܪܝܐ"],
  ["Zurbavel", "ܙܘܪܒܒܠ"],
  ["Archelaus", "ܐܪܟܠܐܘܣ"],
  ["Stephanas", "ܐܣܛܦܢܐ"],
  ["Lois", "ܠܘܐܝܣ"],
  ["Junia", "ܝܘܢܝܐ"],
  ["Phoibe", "ܦܘܒܐ"],
  ["Clement", "ܩܠܡܝܣ"],
  ["Balak", "ܒܠܩ"],
  ["Qorach", "ܩܘܪܚ"],
  ["Barakhya", "ܒܪܟܝܐ"],
  ["Fanu'el", "ܦܢܘܐܝܠ"],
  ["Lysanias", "ܠܘܣܢܝܐ"],
  ["Abilene", "ܐܒܝܠܝܢܐ"],
  ["Ituraea", "ܐܝܛܘܪܝܐ"],
  ["Trachonitis", "ܛܪܟܘܢܐ"],
  ["Yericho", "ܐܝܪܝܚܘ"],
  ["Iriycho", "ܐܝܪܝܚܘ"],
  ["Tiberias", "ܛܒܪܝܘܣ"],
  ["Phoenicia", "ܦܘܢܝܩܐ"],
  ["Iconium", "ܐܝܩܢܘܢ"],
  ["Golgotha", "ܓܓܘܠܬܐ"],
  ["Gabbatha", "ܓܦܝܦܬܐ"],
  ["Cappadocia", "ܩܦܘܕܩܝܐ"],
  ["Libya", "ܠܘܒܐ"],
  ["Gaza", "ܓܙܐ"],
  ["Melita", "ܡܠܝܛܐ"],
  ["Philippi", "ܦܝܠܝܦܘܣ"],
  ["Laodicea", "ܠܕܝܩܝܐ"],
  ["Dalmatya", "ܕܠܡܛܝܐ"],
  ["Tsarfat", "ܨܪܦܬ"],
  ["Korazin", "ܟܘܪܙܝܢ"],
  ["Thessalonica", "ܬܣܠܘܢܝܩܐ"],
  ["Pisidia", "ܦܣܝܕܝܐ"],
  ["Azotus", "ܐܙܘܛܘܣ"],
  ["Saron", "ܣܐܪܘܢ"],
  ["Midian", "ܡܕܝܢ"],
  ["Qedron", "ܩܕܪܘܢ"],
  ["Magdala", "ܡܓܕܠܐ"],
  ["Beor", "ܒܥܘܪ"],
  ["Yoel", "ܝܘܐܝܠ"],
  ["Shelatiel", "ܫܠܬܐܝܠ"],
  ["Ir", "ܥܝܪ"],
  ["Balaam", "ܒܠܥܡ"],
  ["Charan", "ܚܪܢ"],
  ["Zmurna", "ܙܡܘܪܢܐ"],
  ["Pergama", "ܦܪܓܡܐ"],
  ["Fortunatus", "ܦܪܛܘܢܛܘܣ"],
  ["Achaicus", "ܐܟܐܝܩܘܣ"],
  ["Eunice", "ܐܘܢܝܩܐ"],
  ["Andronicus", "ܐܢܕܪܘܢܝܩܘܣ"],
  ["Euodia", "ܐܘܗܕܝܐ"],
  ["Syntyche", "ܣܘܢܛܝܟܐ"],
  ["Philimon", "ܦܝܠܡܘܢ"],
  ["Apphia", "ܐܦܝܐ"],
  ["Tertullus", "ܛܪܛܠܘܣ"],
  ["Shapira", "ܫܦܝܪܐ"],
  ["Qayafa", "ܩܝܦܐ"],
  ["Pontius", "ܦܢܛܝܘܣ"],
  ["Erastos", "ܐܪܣܛܘܣ"],
  ["Trophimos", "ܛܪܘܦܝܡܘܣ"],
  ["Qresqos", "ܩܪܣܩܘܣ"],
  ["Galatya", "ܓܠܛܝܐ"],
  ["Yehudaye", "ܝܗܘܕܝܐ"],
  ["Yehudi", "ܝܗܘܕܝܐ"],
  ["Yehudaya", "ܝܗܘܕܝܐ"],
  ["Natsraya", "ܢܨܪܝܐ"],
  ["Samaritans", "ܫܡܪܝܐ"],
  ["Samaritan", "ܫܡܪܝܐ"],
  ["Sadducees", "ܙܕܘܩܝܐ"],
  ["Galileans", "ܓܠܝܠܝܐ"],
  ["Gadarenes", "ܓܕܪܝܐ"],
  ["Aramean", "ܐܪܡܝܐ"],
  ["Aramaye", "ܐܪܡܝܐ"],
  ["Magi", "ܡܓܘܫܐ"],
  ["Magushi", "ܡܓܘܫܐ"],
  ["Chanan", "ܚܢܢ"],
  ["Malki-Zedek", "ܡܠܟܝܙܕܩ"],
  ["Sosthenes", "ܣܘܣܬܢܣ"],
  ["Alexander", "ܐܠܟܣܢܕܪܣ"],
  ["Demetrius", "ܕܡܝܛܪܝܘܣ"],
  ["Aristarchus", "ܐܪܣܛܪܟܘܣ"],
  ["Rufus", "ܪܘܦܘܣ"],
  ["Nicolaitans", "ܢܐܩܘܠܝܛܐ"],
  ["Sheol", "ܫܝܘܠ"],
];
for (const [token, sy] of HAND) {
  const hits = versesOf(token);
  const parts = sy.split(" ");
  const ok = hits.filter((verse) => parts.every((part) => verse.raw.some((word) => nameKeys(word).includes(part))));
  if (ok.length < 1) continue;
  const existing = rows.find((row) => row.en === token || row.forms.includes(token));
  const wantPlace = PLACES.has(token) || PLACES.has(FAMILIAR[token] || "");
  if (existing && existing.sy !== sy && !sy.includes(" ") && !(wantPlace && existing.kind === "person")) {
    if (bestDist(token, sy) + 0 < bestDist(token, existing.sy.split(" ")[0] || existing.sy)) {
      existing.sy = sy;
      existing.say = readingOf(sy, token);
    }
  }
  if (taken.has(token) && !(wantPlace && existing?.kind === "person")) continue;
  addHarvested(token, sy, ok);
}

for (const row of rows) {
  if (/^d[-']/.test(row.say)) row.say = row.en;
  if (row.en === "Yisrael") row.kind = "person";
  if (row.en === "Bar-Tulmay") row.known = "Bartholomew";
  if (row.en === "Shalem") row.known = "Salem";
  if (row.en === "Alap") row.known = "Alpha";
  if (row.en === "Tau") row.known = "Omega";
  if (!row.sy.includes(" ")) {
    for (const pre of SINGLE) {
      if (!row.sy.startsWith(pre) || row.sy.length <= 3) continue;
      const inner = row.sy.slice(1);
      if (bestDist(row.en, inner) < bestDist(row.en, row.sy)) {
        row.sy = inner;
        if (/^d[-']/.test(row.say)) row.say = row.en;
      }
      break;
    }
  }
}
for (let i = rows.length - 1; i >= 0; i--) {
  if (rowDrop(rows[i])) rows.splice(i, 1);
}

function rowDrop(row) {
  if (row.en === "Am") return true;
  if (NOT_A_NAME.has(row.en)) return true;
  return false;
}

for (const row of rows) promote(row);

const byPrinted = new Map();
for (const row of rows) {
  if (!byPrinted.has(row.en)) byPrinted.set(row.en, []);
  byPrinted.get(row.en).push(row);
}
for (const group of byPrinted.values()) {
  if (group.length < 2) continue;
  for (const row of group) {
    const others = group.filter((other) => other !== row).map((other) => other.sy);
    if (!others.length || row.note.includes("also spells")) continue;
    row.note += ` The Peshitta also spells this name ${others.join(" and ")}.`;
  }
}

for (const row of rows) {
  if (row.en === "Philippi" && !row.note.includes("Philipos")) {
    row.note += " This Peshitta spells the city with the same letters it uses for Philipos.";
  }
  if (row.sy === "ܢܝܢܘܝܐ" && !row.note.includes("Ninevites")) {
    row.note += " These letters name the people of Nineveh where the book says Ninevites.";
  }
  if (row.en === "Gabbatha" && row.sy === "ܓܦܝܦܬܐ" && !row.note.includes("this edition")) {
    row.note += " John calls this the Hebrew name of the pavement. This edition writes it ܓܦܝܦܬܐ.";
  }
  if (row.en === "Alap" && !row.note.includes("first letter")) {
    row.note += " Alap is the first letter. Tau, in the same saying, is the last. The familiar pair is Alpha and Omega.";
  }
  if (row.en === "Tau" && !row.note.includes("last letter")) {
    row.note += " Tau is the last letter. Alap, in the same saying, is the first. The familiar pair is Alpha and Omega.";
  }
  if (row.en === "Issachar" && row.sy === "ܐܝܣܟܪ") {
    row.note += " The Hebrew writing is longer: יִשָּׂשכָר. This Peshitta uses the shorter spelling.";
  }
  if (row.sy === "ܝܘܢܝܐ") {
    row.say = "Yunia";
    row.kind = "person";
    for (const form of ["Junia", "Yawnaye"]) if (!row.forms.includes(form)) row.forms.push(form);
    row.note =
      "The Peshitta writes ܝܘܢܝܐ. In Romans 16:7 this book prints Junia, greeted with Andronicus. Read that name Yunia. The same letters, where the book prints Yawnaye, name the Greeks. The Greek writes Ἰουνία for the person and Ἕλλην where this Peshitta says an Aramean or a Greek.";
  }
  if (row.en === "Tau" || row.en === "Alap") row.kind = "letter";
  if (row.sy === "ܚܢܢ") {
    row.say = "hnan";
    row.known = "Annas";
    row.note =
      "The Peshitta writes this person ܚܢܢ. This book prints Chanan. The familiar English is Annas, the high priest in Acts 4:6. Read the letters hnan. The Hebrew name is חָנָן, Hanan, gracious. The Greek writes Ἅννας.";
  }
  if (row.sy === "ܝܗܘܕܝܐ") {
    row.kind = "people";
    row.say = "Yehudaye";
    row.known = "Jews";
    row.note =
      "The Peshitta writes ܝܗܘܕܝܐ. This book prints Yehudaye, and also Yehudi and Yehudaya. The familiar English is a Jew. Read the letters Yehudaye. The Hebrew is יְהוּדִי, Yehudi, a person of Judah. The Greek is Ἰουδαῖος.";
  }
  if (row.sy === "ܢܨܪܝܐ") {
    row.kind = "people";
    row.known = "Nazarene";
    row.say = "Natsraya";
    row.note =
      "The Peshitta writes ܢܨܪܝܐ. This book prints Natsraya. The familiar English is Nazarene, a person of Natsrath. Read the letters Natsraya. The Greek is Ναζωραῖος. It is the town-name, not a second title.";
  }
}

const sourceTable = JSON.parse(readFileSync("scripts/name-sources.json", "utf8"));
for (const row of rows) {
  const sources = sourceTable[row.sy] || sourceTable[row.en] || row.forms.map((form) => sourceTable[form]).find(Boolean) || null;
  if (sources) row.sources = sources;
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
        note: "Persons and places in this Peshitta. sy is the spelling in the text. en is the form printed in this book. known is the familiar English finder. say is a reading of the Syriac letters, not a second translation. sources, when present, are the Hebrew or Greek writing of that name, not a pronunciation of the Syriac.",
        names: rows,
      },
      null,
      2,
    ) + "\n",
  );
}
