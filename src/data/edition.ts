export type BookMeta = {
  id: string;
  name: string;
  sy: string;
  section: "Gospels" | "Acts" | "Paul" | "Letters" | "Apocalypse";
  later?: boolean;
  blurb: string;
};

export const SECTIONS = ["Gospels", "Acts", "Paul", "Letters", "Apocalypse"] as const;

export const BOOKS: BookMeta[] = [
  { id: "matthew", name: "Matthew", sy: "ܡܬܝ", section: "Gospels", blurb: "The announcement of Matthew the legate. The subscription says he published it in Hebrew, in the land of the Palestinians." },
  { id: "mark", name: "Mark", sy: "ܡܪܩܘܣ", section: "Gospels", blurb: "This edition includes the longer ending, 16:9–20. The subscription says he proclaimed it in Latin at Rome." },
  { id: "luke", name: "Luke", sy: "ܠܘܩܐ", section: "Gospels", blurb: "The holy gospel of Luke. The infancy hymns and the passion keep a strongly Semitic line." },
  { id: "john", name: "John", sy: "ܝܘܚܢܢ", section: "Gospels", blurb: "The subscription says John uttered it in Greek at Ephesus. The Peshitta itself is Syriac; that line is the manuscript’s claim, not a settled history." },
  { id: "acts", name: "Acts", sy: "ܦܪܟܣܝܣ", section: "Acts", blurb: "The Acts of the blessed legates, as the subscription names them: their histories." },
  { id: "romans", name: "Romans", sy: "ܪܗܘܡܝܐ", section: "Paul", blurb: "Paul to Rome. Murdock keeps the solemn English of the Authorized style, thou and ye." },
  { id: "1corinthians", name: "1 Corinthians", sy: "ܩܘܪܝܢܬܝܐ ܐ", section: "Paul", blurb: "To Corinth, the first letter. The supper and the resurrection are in chapters 11 and 15." },
  { id: "2corinthians", name: "2 Corinthians", sy: "ܩܘܪܝܢܬܝܐ ܒ", section: "Paul", blurb: "The second letter to Corinth." },
  { id: "galatians", name: "Galatians", sy: "ܓܠܛܝܐ", section: "Paul", blurb: "To the Galatians. Law, promise, and the sending of the Son." },
  { id: "ephesians", name: "Ephesians", sy: "ܐܦܣܝܐ", section: "Paul", blurb: "To Ephesus. One body, and grace that is not from works." },
  { id: "philippians", name: "Philippians", sy: "ܦܝܠܝܦܣܝܐ", section: "Paul", blurb: "To Philippi. The hymn of the likeness of God is in chapter 2." },
  { id: "colossians", name: "Colossians", sy: "ܩܘܠܣܝܐ", section: "Paul", blurb: "To Colossae. The firstborn of all creation stands in chapter 1." },
  { id: "1thessalonians", name: "1 Thessalonians", sy: "ܬܣܠܘܢܝܩܝܐ ܐ", section: "Paul", blurb: "The first letter to Thessalonica." },
  { id: "2thessalonians", name: "2 Thessalonians", sy: "ܬܣܠܘܢܝܩܝܐ ܒ", section: "Paul", blurb: "The second letter to Thessalonica." },
  { id: "1timothy", name: "1 Timothy", sy: "ܛܝܡܬܐܘܣ ܐ", section: "Paul", blurb: "The first charge to Timothy." },
  { id: "2timothy", name: "2 Timothy", sy: "ܛܝܡܬܐܘܣ ܒ", section: "Paul", blurb: "The second charge to Timothy." },
  { id: "titus", name: "Titus", sy: "ܛܛܘܣ", section: "Paul", blurb: "To Titus." },
  { id: "philemon", name: "Philemon", sy: "ܦܝܠܡܘܢ", section: "Paul", blurb: "A letter of one chapter, for Onesimus." },
  { id: "hebrews", name: "Hebrews", sy: "ܥܒܪܝܐ", section: "Letters", blurb: "To the Hebrews. Like the Greek, the Peshitta leaves the writer unnamed." },
  { id: "james", name: "James", sy: "ܝܥܩܘܒ", section: "Letters", blurb: "Jacob. Faith that does not act is treated in chapter 2." },
  { id: "1peter", name: "1 Peter", sy: "ܦܛܪܘܣ ܐ", section: "Letters", blurb: "The first letter of Peter. Part of the original Peshitta." },
  { id: "2peter", name: "2 Peter", sy: "ܦܛܪܘܣ ܒ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. The Syriac here is the later translation printed with the New Testament." },
  { id: "1john", name: "1 John", sy: "ܝܘܚܢܢ ܐ", section: "Letters", blurb: "The first letter of John. Part of the original Peshitta. It does not carry the later “three heavenly witnesses.”" },
  { id: "2john", name: "2 John", sy: "ܝܘܚܢܢ ܒ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. A later Syriac letter of one chapter." },
  { id: "3john", name: "3 John", sy: "ܝܘܚܢܢ ܓ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. A later Syriac letter of one chapter." },
  { id: "jude", name: "Jude", sy: "ܝܗܘܕܐ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. The Syriac is the later translation." },
  { id: "revelation", name: "Revelation", sy: "ܓܠܝܢܐ", section: "Apocalypse", later: true, blurb: "Not in the original Peshitta. The British and Foreign Bible Society text is John Gwynn’s edition of the Crawford manuscript." },
];

export function bookMeta(id: string) {
  return BOOKS.find((b) => b.id === id);
}

/** Study notes keyed book.chapter.verse. These are notes on the wording, not a second translation. */
export const NOTES: Record<string, string> = {
  "matthew.1.1":
    "ܟܬܒܐ ܕܝܠܝܕܘܬܗ — “the book of his birth.” Yaliduta is the same family of words as the Hebrew toledoth, a generation or nativity. Murdock chose “nativity.” The subscription at the end of the gospel says Matthew published it in Hebrew in Palestine. In Syriac Christian use, “Hebrew” often means the Jewish language of the land, which was Aramaic.",
  "matthew.1.16":
    "ܓܒܪܗ ܕܡܪܝܡ ܕܡܢܗ ܐܬܝܠܕ — “her husband, from whom was born.” The “from whom” is feminine: it points to Mary, not to Joseph. The line does not say Joseph begot Jesus.",
  "matthew.1.21":
    "The name ܝܫܘܥ is explained by the verb ܢܚܝܘܗܝ, “he will make them live,” from the root for life. Murdock will not say “save.” He writes “resuscitate,” and he explains that choice in his preface: the Syriac word is a life-giver, not the Latin Saviour.",
  "matthew.1.23":
    "ܒܬܘܠܬܐ is “virgin,” not only a young woman. ܥܡܢܘܐܝܠ is then interpreted in the verse itself: ܥܡܢ ܐܠܗܢ, “our God with us.”",
  "matthew.5.3":
    "ܛܘܒܝܗܘܢ is the beatitude, “blessed are they,” literally “their good.” ܠܡܣܟܢܐ ܒܪܘܚ — “the poor in spirit.” The kingdom is ܡܠܟܘܬܐ ܕܫܡܝܐ, of heaven.",
  "matthew.6.9":
    "The prayer opens ܐܒܘܢ ܕܒܫܡܝܐ, “our Father who is in heaven,” and ܢܬܩܕܫ ܫܡܟ, “may your name be holy.”",
  "matthew.6.11":
    "ܠܚܡܐ ܕܣܘܢܩܢܢ ܝܘܡܢܐ — “the bread of our need, today.” The Syriac does not use the difficult Greek word that English Bibles render “daily.” Murdock: “our needful bread, this day.”",
  "matthew.6.12":
    "ܚܘܒܝܢ are debts, and ܚܝܒܝܢ are debtors. The line is about what is owed, not about “trespasses.”",
  "matthew.6.13":
    "ܠܐ ܬܥܠܢ ܠܢܣܝܘܢܐ — “do not bring us into trial.” ܦܨܢ ܡܢ ܒܝܫܐ — “deliver us from the evil one.” This Peshitta text includes the doxology: the kingdom, the power, and the glory are his, ܠܥܠܡ ܥܠܡܝܢ, for the age of ages.",
  "matthew.16.18":
    "ܐܢܬ ܗܘ ܟܐܦܐ ܘܥܠ ܗܕܐ ܟܐܦܐ — “you are Kepha, and upon this kepha.” Name and stone are one word. Greek has to switch between Petros and petra. ܬܪܥܐ ܕܫܝܘܠ is “the gates of Sheol,” the place of the dead. Murdock writes “the gates of death.” The assembly is ܥܕܬܝ, “my church.”",
  "matthew.27.46":
    "ܐܝܠ ܐܝܠ ܠܡܢܐ ܫܒܩܬܢܝ — “Eli, Eli, why have you forsaken me?” Murdock translates the cry “O God, O God,” and keeps the sounds in his footnote. ܠܡܢܐ is “why.” ܫܒܩܬܢܝ is “you have left me.”",
  "matthew.28.19":
    "ܐܥܡܕܘ is the causative of “to stand”: make them stand, confirm them. That is the verb Murdock still translates “baptize,” as he warns in the preface. It is done ܒܫܡ, “in the name,” singular, of the Father and the Son and the Spirit of holiness.",
  "mark.5.41":
    "ܛܠܝܬܐ ܩܘܡܝ — “little girl, arise.” The Greek of Mark already transliterates this Aramaic. Here it is simply the language of the verse. Murdock: “Maiden, arise.”",
  "mark.7.34":
    "The word the Greek spells ephphatha is the Syriac ܐܬܦܬܚ, “be opened.”",
  "mark.16.8":
    "In the oldest Greek copies Mark ends with the women’s fear, at verse 8. This Peshitta text goes on through verse 20.",
  "mark.16.9":
    "The longer ending is present in this edition: he arose on the first of the week and appeared first to Mary Magdalene.",
  "luke.23.34":
    "The Peshitta includes the prayer, ܐܒܐ ܫܒܘܩ ܠܗܘܢ — “Father, forgive them.” Some Greek copies omit it. ܫܒܘܩ is the same root as the debts in the prayer: let it go, forgive.",
  "luke.23.43":
    "ܝܘܡܢܐ ܥܡܝ ܬܗܘܐ ܒܦܪܕܝܣܐ — “today you shall be with me in paradise.” In the Syriac, “today” stands with “you shall be,” not with “I say to you.”",
  "john.1.1":
    "ܡܠܬܐ, miltha, is a word, a matter, the expression of a person. Murdock keeps “Word.” The last clause is ܘܐܠܗܐ ܐܝܬܘܗܝ ܗܘܐ ܗܘ ܡܠܬܐ — “and God was that miltha.” Syriac has no indefinite article. The pronoun ܗܘ points back to the Word. It is the same shape as the Greek “and the Word was God,” with “God” placed first for force. It is not a second, lesser god.",
  "john.1.14":
    "ܘܡܠܬܐ ܒܣܪܐ ܗܘܐ — “and the miltha became flesh.” ܘܐܓܢ ܒܢ — “and he tabernacled among us,” he pitched his dwelling. Murdock keeps “tabernacled.” The only one is ܝܚܝܕܝܐ, and the fullness is grace and ܩܘܫܬܐ, truth.",
  "john.3.16":
    "ܠܒܪܗ ܝܚܝܕܝܐ — “his only son.” ܚܝܐ ܕܠܥܠܡ is life of the age, which Murdock writes “life eternal.” The verb “perish” is ܢܐܒܕ.",
  "john.7.53":
    "Murdock’s own note is on this verse: it is missing in many early Syriac editions, and so is the story of the adulteress in the next chapter. The British and Foreign text printed here does include John 7:53–8:11. Read his footnote beside the Syriac.",
  "john.8.58":
    "The last words are ܐܢܐ ܐܝܬܝ — “I am,” the existential, not a past-tense verb. The clause is “before Abraham shall come to be.” Murdock turns that into English past: “before Abraham existed, I was.”",
  "john.19.30":
    "ܗܐ ܡܫܠܡ — “Behold, it is completed.” Murdock’s “Lo; Done.” is that one word, meshallam: finished, fulfilled.",
  "john.20.28":
    "ܡܪܝ ܘܐܠܗܝ — “my Lord and my God.” Thomas says both to Jesus. ܐܠܗܝ is “my God,” the same word as Alaha with the suffix.",
  "acts.2.38":
    "ܒܫܡܗ ܕܡܪܝܐ ܝܫܘܥ — “in the name of the LORD Jesus.” Marya is the Syriac name of the LORD. The purpose is ܠܫܘܒܩܢ ܚܛܗܐ, “for the forgiveness of sins,” and the promise is ܡܘܗܒܬܐ, the gift, of the Holy Spirit. The speaker is named Simon, not Peter.",
  "acts.26.14":
    "The voice spoke ܥܒܪܐܝܬ, “in Hebrew.” In the first century that word often means the Jewish speech of the land, Aramaic, rather than biblical Hebrew. The cry is ܫܐܘܠ ܫܐܘܠ, Shaul, Shaul.",
  "philippians.2.6":
    "ܒܕܡܘܬܐ ܕܐܠܗܐ — “in the likeness of God.” The Greek word there is morphē, form; the Syriac chose dmuta, likeness. ܚܛܘܦܝܐ is a thing seized, a robbery, the word behind Greek harpagmon. ܦܚܡܐ ܕܐܠܗܐ is “the equal of God.” Murdock reads the whole line: he “deemed it no trespass to be the coequal of God.”",
  "1john.4.8":
    "ܐܠܗܐ ܚܘܒܐ ܗܘ — “God is love.” The pronoun ܗܘ marks the identification. Whoever does not love, ܠܐ ܡܚܒ, does not know God.",
  "1john.5.7":
    "The Syriac line here is about the Spirit who testifies, because the Spirit is the truth. It is not the “three heavenly witnesses.” Murdock printed that later sentence in italics at this verse number, and his footnote says it is missing in most manuscripts and was omitted in the London edition of 1826. The italics are his warning. The Syriac beside them is the Peshitta.",
  "2peter.1.1":
    "Second Peter was not part of the original Peshitta, the twenty-two-book New Testament of the Syriac churches. The text in this edition is the later Syriac translation, as printed by the Bible Society.",
  "jude.1.1":
    "Jude was outside the original Peshitta canon. What you are reading is the later Syriac of the book, set in parallel with Murdock’s English.",
  "revelation.1.1":
    "Revelation was outside the original Peshitta. The Syriac is John Gwynn’s edition of the Crawford manuscript, the text the Bible Society printed in 1905, not the Peshitta proper. ܓܠܝܢܐ is “revelation.”",
};
