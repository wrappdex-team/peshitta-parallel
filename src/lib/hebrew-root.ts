import type { WordStudy } from "@/lib/scripture";

/** A Hebrew reading we are willing to have spoken. `speak` is the pronunciation, syllable by syllable. */
export type HebrewReading = {
  text: string;
  speak: string;
  letters: string[];
  note: string;
};

const TO_HEBREW: Record<string, string> = {
  "ܐ": "א", "ܒ": "ב", "ܓ": "ג", "ܕ": "ד", "ܗ": "ה", "ܘ": "ו", "ܙ": "ז",
  "ܚ": "ח", "ܛ": "ט", "ܝ": "י", "ܟ": "כ", "ܠ": "ל", "ܡ": "מ", "ܢ": "נ",
  "ܣ": "ס", "ܥ": "ע", "ܦ": "פ", "ܨ": "צ", "ܩ": "ק", "ܪ": "ר", "ܫ": "ש", "ܬ": "ת",
};

type Form = { he: string; speak: string; gloss: string };

/** Real Hebrew of a Syriac root: same three letters where the language still has them, with the vowels a reader should say. */
const ROOTS: Record<string, Form> = {
  "ܐܡܪ": { he: "אָמַר", speak: "a mar", gloss: "he said" },
  "ܟܬܒ": { he: "כָּתַב", speak: "ka tav", gloss: "he wrote" },
  "ܫܡܥ": { he: "שָׁמַע", speak: "sha ma", gloss: "he heard" },
  "ܚܙܐ": { he: "חָזָה", speak: "kha za", gloss: "he saw" },
  "ܝܕܥ": { he: "יָדַע", speak: "ya da", gloss: "he knew" },
  "ܝܗܒ": { he: "יָהַב", speak: "ya hav", gloss: "he gave" },
  "ܐܬܐ": { he: "אָתָה", speak: "a ta", gloss: "he came" },
  "ܐܙܠ": { he: "אָזַל", speak: "a zal", gloss: "he went" },
  "ܥܒܕ": { he: "עָבַד", speak: "a vad", gloss: "he did, he served" },
  "ܩܛܠ": { he: "קָטַל", speak: "ka tal", gloss: "he killed" },
  "ܩܪܐ": { he: "קָרָא", speak: "ka ra", gloss: "he called, he read" },
  "ܚܝܐ": { he: "חָיָה", speak: "kha ya", gloss: "he lived" },
  "ܐܟܠ": { he: "אָכַל", speak: "a khal", gloss: "he ate" },
  "ܫܬܐ": { he: "שָׁתָה", speak: "sha ta", gloss: "he drank" },
  "ܐܚܒ": { he: "אָהַב", speak: "a hav", gloss: "he loved" },
  "ܪܚܡ": { he: "רִחַם", speak: "ri kham", gloss: "he had mercy" },
  "ܗܘܐ": { he: "הָיָה", speak: "ha ya", gloss: "he was" },
  "ܩܕܫ": { he: "קָדַשׁ", speak: "ka dash", gloss: "he was holy" },
  "ܫܠܡ": { he: "שָׁלַם", speak: "sha lam", gloss: "he was whole" },
  "ܒܪܟ": { he: "בֵּרַךְ", speak: "be rakh", gloss: "he blessed" },
  "ܩܕܡ": { he: "קָדַם", speak: "ka dam", gloss: "he was before" },
  "ܡܠܐ": { he: "מָלֵא", speak: "ma le", gloss: "he was full" },
  "ܡܠܟ": { he: "מָלַךְ", speak: "ma lakh", gloss: "he reigned" },
  "ܫܒܩ": { he: "שָׁבַק", speak: "sha vak", gloss: "he left, he forgave" },
  "ܦܩܕ": { he: "פָּקַד", speak: "pa kad", gloss: "he commanded" },
  "ܫܠܚ": { he: "שָׁלַח", speak: "sha lakh", gloss: "he sent" },
  "ܢܛܪ": { he: "נָטַר", speak: "na tar", gloss: "he kept" },
  "ܦܬܚ": { he: "פָּתַח", speak: "pa takh", gloss: "he opened" },
  "ܢܦܩ": { he: "נָפַק", speak: "na fak", gloss: "he went out" },
  "ܣܠܩ": { he: "סָלַק", speak: "sa lak", gloss: "he went up" },
  "ܢܚܬ": { he: "נָחַת", speak: "na khat", gloss: "he went down" },
  "ܩܪܒ": { he: "קָרַב", speak: "ka rav", gloss: "he drew near" },
  "ܗܦܟ": { he: "הָפַךְ", speak: "ha fakh", gloss: "he turned" },
  "ܩܘܡ": { he: "קָם", speak: "kam", gloss: "he arose" },
  "ܡܘܬ": { he: "מֵת", speak: "met", gloss: "he died" },
  "ܝܬܒ": { he: "יָתֵב", speak: "ya tev", gloss: "he sat" },
  "ܥܢܐ": { he: "עָנָה", speak: "a na", gloss: "he answered" },
  "ܫܐܠ": { he: "שָׁאַל", speak: "sha al", gloss: "he asked" },
  "ܫܩܠ": { he: "שָׁקַל", speak: "sha kal", gloss: "he took" },
  "ܪܕܦ": { he: "רָדַף", speak: "ra daf", gloss: "he pursued" },
  "ܓܠܐ": { he: "גָּלָה", speak: "ga la", gloss: "he revealed" },
  "ܟܣܐ": { he: "כָּסָה", speak: "ka sa", gloss: "he covered" },
  "ܙܒܢ": { he: "זָבַן", speak: "za van", gloss: "he bought" },
  "ܡܠܠ": { he: "מִלֵּל", speak: "mi lel", gloss: "he spoke" },
  "ܫܒܚ": { he: "שִׁבַּח", speak: "shi bakh", gloss: "he praised" },
  "ܚܫܒ": { he: "חָשַׁב", speak: "kha shav", gloss: "he thought" },
  "ܚܫܟ": { he: "חָשַׁךְ", speak: "kha shakh", gloss: "it was dark" },
  "ܚܒܠ": { he: "חָבַל", speak: "kha val", gloss: "he destroyed" },
  "ܦܪܩ": { he: "פָּרַק", speak: "pa rak", gloss: "he saved" },
  "ܟܦܪ": { he: "כָּפַר", speak: "ka far", gloss: "he denied" },
  "ܐܡܢ": { he: "הֶאֱמִין", speak: "he e min", gloss: "he believed" },
  "ܫܘܒ": { he: "שָׁב", speak: "shav", gloss: "he returned" },
  "ܕܒܪ": { he: "דָּבַר", speak: "da var", gloss: "he led" },
  "ܛܥܡ": { he: "טָעַם", speak: "ta am", gloss: "he tasted" },
  "ܢܦܫ": { he: "נֶפֶשׁ", speak: "ne fesh", gloss: "soul" },
  "ܪܘܚ": { he: "רוּחַ", speak: "ru akh", gloss: "spirit" },
  "ܐܪܥ": { he: "אֶרֶץ", speak: "e rets", gloss: "earth" },
  "ܫܡܝ": { he: "שָׁמַיִם", speak: "sha ma yim", gloss: "heaven" },
  "ܝܘܡ": { he: "יוֹם", speak: "yom", gloss: "day" },
  "ܡܝܐ": { he: "מַיִם", speak: "ma yim", gloss: "water" },
  "ܠܚܡ": { he: "לֶחֶם", speak: "le khem", gloss: "bread" },
  "ܐܒ": { he: "אָב", speak: "av", gloss: "father" },
  "ܐܚ": { he: "אָח", speak: "akh", gloss: "brother" },
  "ܐܡ": { he: "אֵם", speak: "em", gloss: "mother" },
  "ܫܡ": { he: "שֵׁם", speak: "shem", gloss: "name" },
  "ܒܝܬ": { he: "בַּיִת", speak: "ba yit", gloss: "house" },
  "ܕܡ": { he: "דָּם", speak: "dam", gloss: "blood" },
  "ܕܡܐ": { he: "דָּם", speak: "dam", gloss: "blood" },
  "ܐܢܫ": { he: "אֱנוֹשׁ", speak: "e nosh", gloss: "man" },
  "ܓܒܪ": { he: "גֶּבֶר", speak: "ge ver", gloss: "man" },
  "ܡܠܟܐ": { he: "מֶלֶךְ", speak: "me lekh", gloss: "king" },
  "ܚܕ": { he: "אֶחָד", speak: "e khad", gloss: "one" },
  "ܚܕܐ": { he: "אֶחָד", speak: "e khad", gloss: "one" },
  "ܐܠܗ": { he: "אֱלֹהַּ", speak: "e lo ah", gloss: "God" },
  "ܡܫܝܚ": { he: "מָשִׁיחַ", speak: "ma shi akh", gloss: "anointed" },
  "ܫܠܝܚ": { he: "שָׁלִיחַ", speak: "sha li akh", gloss: "one sent" },
  "ܟܗܢ": { he: "כֹּהֵן", speak: "ko hen", gloss: "priest" },
  "ܢܒܝ": { he: "נָבִיא", speak: "na vi", gloss: "prophet" },
  "ܥܡ": { he: "עַם", speak: "am", gloss: "people" },
  "ܥܡܐ": { he: "עַם", speak: "am", gloss: "people" },
  "ܐܘܪܚ": { he: "אוֹרַח", speak: "o rakh", gloss: "way" },
  "ܫܒܝܠ": { he: "שְׁבִיל", speak: "shvil", gloss: "path" },
  "ܗܝܟܠ": { he: "הֵיכָל", speak: "hei khal", gloss: "temple" },
  "ܡܕܒܚ": { he: "מִזְבֵּחַ", speak: "miz be akh", gloss: "altar" },
  "ܙܒܚ": { he: "זָבַח", speak: "za vakh", gloss: "he sacrificed" },
  "ܐܝܠܢ": { he: "אִילָן", speak: "i lan", gloss: "tree" },
  "ܦܐܪ": { he: "פְּרִי", speak: "pe ri", gloss: "fruit" },
  "ܝܡ": { he: "יָם", speak: "yam", gloss: "sea" },
  "ܝܡܐ": { he: "יָם", speak: "yam", gloss: "sea" },
  "ܡܕܝܢ": { he: "מְדִינָה", speak: "me di na", gloss: "city" },
  "ܡܠܟܘ": { he: "מַלְכוּת", speak: "mal khut", gloss: "kingdom" },
  "ܚܘܒ": { he: "חוֹב", speak: "khov", gloss: "debt" },
  "ܝܩܪ": { he: "יָקָר", speak: "ya kar", gloss: "honor" },
  "ܦܓܪ": { he: "פֶּגֶר", speak: "pe ger", gloss: "body" },
  "ܫܡܫ": { he: "שִׁמֵּשׁ", speak: "shi mesh", gloss: "he served" },
  "ܣܗܕ": { he: "סָהֵד", speak: "sa hed", gloss: "witness" },
  "ܫܪܐ": { he: "שָׁרָא", speak: "sha ra", gloss: "he loosed" },
  "ܢܗܪ": { he: "נְהוֹרָא", speak: "ne ho ra", gloss: "light" },
  "ܚܝܠ": { he: "חַיִל", speak: "kha yil", gloss: "power" },
  "ܫܠܡܐ": { he: "שָׁלוֹם", speak: "sha lom", gloss: "peace" },
  "ܚܛܐ": { he: "חָטָא", speak: "kha ta", gloss: "he sinned" },
  "ܬܘܒ": { he: "שָׁב", speak: "shav", gloss: "he returned" },
  "ܒܥܐ": { he: "בָּעָא", speak: "ba a", gloss: "he sought" },
  "ܦܠܚ": { he: "פָּלַח", speak: "pa lakh", gloss: "he worked" },
  "ܕܚܠ": { he: "דָּחַל", speak: "da khal", gloss: "he feared" },
  "ܥܠܠ": { he: "עָלַל", speak: "a lal", gloss: "he entered" },
  "ܢܣܒ": { he: "נָסַב", speak: "na sav", gloss: "he took" },
  "ܝܠܦ": { he: "יְלַף", speak: "ye laf", gloss: "he learned" },
};

const NAMES: Record<string, { he: string; speak: string }> = {
  avraham: { he: "אַבְרָהָם", speak: "av ra ham" },
  abraham: { he: "אַבְרָהָם", speak: "av ra ham" },
  isaac: { he: "יִצְחָק", speak: "yits khak" },
  yisrael: { he: "יִשְׂרָאֵל", speak: "yis ra el" },
  israel: { he: "יִשְׂרָאֵל", speak: "yis ra el" },
  "ya'akov": { he: "יַעֲקֹב", speak: "ya a kov" },
  yaakov: { he: "יַעֲקֹב", speak: "ya a kov" },
  moshe: { he: "מֹשֶׁה", speak: "mo she" },
  dawid: { he: "דָּוִד", speak: "da vid" },
  david: { he: "דָּוִד", speak: "da vid" },
  shimon: { he: "שִׁמְעוֹן", speak: "shim on" },
  yochanan: { he: "יוֹחָנָן", speak: "yo kha nan" },
  "y'shua": { he: "יֵשׁוּעַ", speak: "ye shu a" },
  yeshua: { he: "יֵשׁוּעַ", speak: "ye shu a" },
  maryam: { he: "מִרְיָם", speak: "mir yam" },
  elohim: { he: "אֱלֹהִים", speak: "e lo him" },
  mashiyach: { he: "מָשִׁיחַ", speak: "ma shi akh" },
  keefa: { he: "כֵּיפָא", speak: "ke fa" },
  yhwh: { he: "יְהוָה", speak: "yah weh" },
  urishlim: { he: "יְרוּשָׁלַיִם", speak: "ye ru sha la yim" },
  galila: { he: "גָּלִיל", speak: "ga lil" },
  yordanan: { he: "יַרְדֵּן", speak: "yar den" },
  natsrath: { he: "נָצְרַת", speak: "na tse rat" },
  mitsrayin: { he: "מִצְרַיִם", speak: "mits ra yim" },
  sheol: { he: "שְׁאוֹל", speak: "she ol" },
  satana: { he: "שָׂטָן", speak: "sa tan" },
  eliyahu: { he: "אֵלִיָּהוּ", speak: "e li ya hu" },
  adam: { he: "אָדָם", speak: "a dam" },
  noah: { he: "נֹחַ", speak: "no akh" },
  sarah: { he: "שָׂרָה", speak: "sa ra" },
  solomon: { he: "שְׁלֹמֹה", speak: "shlo mo" },
  aaron: { he: "אַהֲרֹן", speak: "a ha ron" },
  yehuda: { he: "יְהוּדָה", speak: "ye hu da" },
  paulos: { he: "פַּוְלוֹס", speak: "pav los" },
  pilatos: { he: "פִּילָטוֹס", speak: "pi la tos" },
  herodes: { he: "הוֹרְדוֹס", speak: "hor dos" },
  babylon: { he: "בָּבֶל", speak: "ba vel" },
  damascus: { he: "דַּמֶּשֶׂק", speak: "da me sek" },
  ephesus: { he: "אֶפְסוֹס", speak: "ef sos" },
  antioch: { he: "אַנְטִיוֹכְיָה", speak: "an ti okh ya" },
  rhoma: { he: "רוֹמִי", speak: "ro mi" },
  tome: { he: "תּוֹמָא", speak: "to ma" },
  toma: { he: "תּוֹמָא", speak: "to ma" },
  luqa: { he: "לוּקָא", speak: "lu ka" },
  mattai: { he: "מַתַּי", speak: "ma tai" },
  philipos: { he: "פִילִיפּוֹס", speak: "fi li pos" },
  andrawos: { he: "אַנְדְּרֵי", speak: "an dre" },
  timothy: { he: "טִימוֹתֵאוֹס", speak: "ti mo te os" },
  titus: { he: "טִיטוֹס", speak: "ti tos" },
  silas: { he: "סִילָא", speak: "si la" },
};

const CLITIC: Record<string, { he: string; speak: string }> = {
  and: { he: "וְ", speak: "ve" },
  in: { he: "בְּ", speak: "be" },
  to: { he: "לְ", speak: "le" },
};

function nameKey(gloss: string) {
  return gloss
    .replace(/^(and|of|in|to|that|his|her|their|your|my|our)\s+/i, "")
    .split(/[,;]/)[0]
    .trim()
    .toLowerCase()
    .replace(/’/g, "'");
}

function lettersOf(root: string[]) {
  return root.map((letter) => TO_HEBREW[letter]).filter(Boolean);
}

function finalForm(letter: string) {
  return ({ כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" } as Record<string, string>)[letter] ?? letter;
}

/** Three Hebrew consonants of a Syriac root, with final letters shaped. No vowels are invented. */
export function hebrewConsonants(root: string[]): string[] {
  const letters = lettersOf(root);
  if (!letters.length) return [];
  const last = letters.length - 1;
  return letters.map((letter, index) => (index === last ? finalForm(letter) : letter));
}

function cliticFor(gloss: string, wordGloss: string) {
  if (gloss === "of") {
    if (/^(who|which|that)\b/i.test(wordGloss)) return { he: "אֲשֶׁר ", speak: "a sher" };
    return { he: "שֶׁל־", speak: "shel" };
  }
  return CLITIC[gloss] ?? null;
}

function withClitics(study: WordStudy, stem: { he: string; speak: string }, note: string): HebrewReading {
  const bits = study.prefixes.map((part) => cliticFor(part.gloss, study.gloss)).filter((item) => item !== null);
  return {
    text: `${bits.map((item) => item.he).join("")}${stem.he}`,
    speak: [...bits.map((item) => item.speak), ...stem.speak.split(" ")].filter(Boolean).join(" "),
    letters: hebrewConsonants(study.root),
    note: study.prefixes.length && !note.startsWith("A name") ? study.gloss : note,
  };
}

function specialRoot(root: string, gloss: string): Form | undefined {
  if (root === "ܒܪܐ") {
    if (/son|child/i.test(gloss)) return { he: "בַּר", speak: "bar", gloss: "son" };
    if (/creat/i.test(gloss)) return { he: "בָּרָא", speak: "ba ra", gloss: "he created" };
  }
  if (root === "ܡܠܟ" && /king|kingdom/i.test(gloss)) return { he: "מֶלֶךְ", speak: "me lekh", gloss: "king" };
  if (root === "ܐܡܪ" && /^say\b/i.test(gloss)) return { he: "אֱמֹר", speak: "e mor", gloss: "say" };
  return undefined;
}

export function rootSpeech(root: string) {
  return ROOTS[root]?.speak ?? null;
}
export function hebrewReading(study: WordStudy): HebrewReading | null {
  const key = nameKey(study.gloss);
  const named = NAMES[key];
  if (named) return withClitics(study, named, "A name. The pronunciation under it is how this edition says the Hebrew.");
  const root = study.root.join("");
  const form = specialRoot(root, study.gloss) ?? ROOTS[root];
  if (!form) return null;
  return withClitics(study, form, form.gloss);
}
