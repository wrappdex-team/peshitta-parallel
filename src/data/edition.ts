export type BookMeta = {
  id: string;
  name: string;
  /** How this book says the Syriac title. Not a second search name. */
  say: string;
  sy: string;
  section: "Gospels" | "Acts" | "Paul" | "Letters" | "Apocalypse";
  later?: boolean;
  blurb: string;
};

export const SECTIONS = ["Gospels", "Acts", "Paul", "Letters", "Apocalypse"] as const;

export const BOOKS: BookMeta[] = [
  { id: "matthew", name: "Matthew", say: "Matai", sy: "ܡܬܝ", section: "Gospels", blurb: "The announcement of Matthew. The subscription says he published it in Hebrew, in the land of the Palestinians." },
  { id: "mark", name: "Mark", say: "Marqos", sy: "ܡܪܩܘܣ", section: "Gospels", blurb: "This edition includes the longer ending, 16:9–20. The subscription says he proclaimed it in Latin at Rome." },
  { id: "luke", name: "Luke", say: "Luqa", sy: "ܠܘܩܐ", section: "Gospels", blurb: "The holy gospel of Luke. The infancy hymns and the passion keep a strongly Semitic line." },
  { id: "john", name: "John", say: "Yochanan", sy: "ܝܘܚܢܢ", section: "Gospels", blurb: "The subscription says John uttered it in Greek at Ephesus. The Peshitta itself is Syriac; that line is the manuscript’s claim, not a settled history." },
  { id: "acts", name: "Acts", say: "Praksis", sy: "ܦܪܟܣܝܣ", section: "Acts", blurb: "The Acts of those who were sent, as the subscription names them: their histories." },
  { id: "romans", name: "Romans", say: "Rhoma", sy: "ܪܗܘܡܝܐ", section: "Paul", blurb: "Paulos to Rome." },
  { id: "1corinthians", name: "1 Corinthians", say: "Corinth", sy: "ܩܘܪܝܢܬܝܐ ܐ", section: "Paul", blurb: "To Corinth, the first letter. The supper and the resurrection are in chapters 11 and 15." },
  { id: "2corinthians", name: "2 Corinthians", say: "Corinth", sy: "ܩܘܪܝܢܬܝܐ ܒ", section: "Paul", blurb: "The second letter to Corinth." },
  { id: "galatians", name: "Galatians", say: "Galatia", sy: "ܓܠܛܝܐ", section: "Paul", blurb: "To the Galatians. Law, promise, and the sending of the Son." },
  { id: "ephesians", name: "Ephesians", say: "Ephesos", sy: "ܐܦܣܝܐ", section: "Paul", blurb: "To Ephesus. One body, and grace that is not from works." },
  { id: "philippians", name: "Philippians", say: "Philippi", sy: "ܦܝܠܝܦܣܝܐ", section: "Paul", blurb: "To Philippi. The hymn of the likeness of Elohim is in chapter 2." },
  { id: "colossians", name: "Colossians", say: "Qolosos", sy: "ܩܘܠܣܝܐ", section: "Paul", blurb: "To Colossae. The firstborn of all creation stands in chapter 1." },
  { id: "1thessalonians", name: "1 Thessalonians", say: "Tesaloniqa", sy: "ܬܣܠܘܢܝܩܝܐ ܐ", section: "Paul", blurb: "The first letter to Thessalonica." },
  { id: "2thessalonians", name: "2 Thessalonians", say: "Tesaloniqa", sy: "ܬܣܠܘܢܝܩܝܐ ܒ", section: "Paul", blurb: "The second letter to Thessalonica." },
  { id: "1timothy", name: "1 Timothy", say: "Timotheos", sy: "ܛܝܡܬܐܘܣ ܐ", section: "Paul", blurb: "The first charge to Timothy." },
  { id: "2timothy", name: "2 Timothy", say: "Timotheos", sy: "ܛܝܡܬܐܘܣ ܒ", section: "Paul", blurb: "The second charge to Timothy." },
  { id: "titus", name: "Titus", say: "Titus", sy: "ܛܛܘܣ", section: "Paul", blurb: "To Titus." },
  { id: "philemon", name: "Philemon", say: "Philimon", sy: "ܦܝܠܡܘܢ", section: "Paul", blurb: "A letter of one chapter, for Onesimus." },
  { id: "hebrews", name: "Hebrews", say: "Ebraye", sy: "ܥܒܪܝܐ", section: "Letters", blurb: "To the Hebrews. Like the Greek, the Peshitta leaves the writer unnamed." },
  { id: "james", name: "James", say: "Ya'akov", sy: "ܝܥܩܘܒ", section: "Letters", blurb: "Ya'akov. Faith that does not act is treated in chapter 2." },
  { id: "1peter", name: "1 Peter", say: "Keefa", sy: "ܦܛܪܘܣ ܐ", section: "Letters", blurb: "The first letter of Keefa. Part of the original Peshitta." },
  { id: "2peter", name: "2 Peter", say: "Keefa", sy: "ܦܛܪܘܣ ܒ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. The Syriac here is the later translation printed with the New Testament." },
  { id: "1john", name: "1 John", say: "Yochanan", sy: "ܝܘܚܢܢ ܐ", section: "Letters", blurb: "The first letter of Yochanan. Part of the original Peshitta. It does not carry the later “three heavenly witnesses.”" },
  { id: "2john", name: "2 John", say: "Yochanan", sy: "ܝܘܚܢܢ ܒ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. A later Syriac letter of one chapter." },
  { id: "3john", name: "3 John", say: "Yochanan", sy: "ܝܘܚܢܢ ܓ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. A later Syriac letter of one chapter." },
  { id: "jude", name: "Jude", say: "Yehuda", sy: "ܝܗܘܕܐ", section: "Letters", later: true, blurb: "Not in the original Peshitta canon. The Syriac is the later translation." },
  { id: "revelation", name: "Revelation", say: "Gelyana", sy: "ܓܠܝܢܐ", section: "Apocalypse", later: true, blurb: "Not in the original Peshitta. The British and Foreign Bible Society text is John Gwynn’s edition of the Crawford manuscript." },
];

export function bookMeta(id: string) {
  return BOOKS.find((b) => b.id === id);
}

/** Study notes keyed book.chapter.verse. These are notes on the wording, not a second translation. */
export const NOTES: Record<string, string> = {
  "matthew.1.1":
    "ܟܬܒܐ ܕܝܠܝܕܘܬܗ — “the book of his birth.” Yaliduta is the same family of words as the Hebrew toledoth, a generation or nativity. Murdock chose “nativity.” The subscription at the end of the gospel says Matthew published it in Hebrew in Palestine. In Syriac Christian use, “Hebrew” often means the Jewish language of the land, which was Aramaic.",
  "matthew.1.16":
    "ܓܒܪܗ ܕܡܪܝܡ ܕܡܢܗ ܐܬܝܠܕ — “her husband, from whom was born.” The “from whom” is feminine: it points to Maryam, not to Yosip. The line does not say Yosip begot Y'shua.",
  "matthew.1.21":
    "The name ܝܫܘܥ is explained by the verb ܢܚܝܘܗܝ, “he will make them live,” from the root for life. The English says he will give life to his people, not that he will “save” them in the Latin sense.",
  "matthew.1.23":
    "ܒܬܘܠܬܐ is “virgin,” not only a young woman. ܥܡܢܘܐܝܠ is then interpreted in the verse itself: ܥܡܢ ܐܠܗܢ, “our Elohim with us.”",
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
    "ܐܢܬ ܗܘ ܟܐܦܐ ܘܥܠ ܗܕܐ ܟܐܦܐ — “you are Keefa, and upon this keefa.” Name and stone are one word. Greek has to switch between Petros and petra. ܬܪܥܐ ܕܫܝܘܠ is “the gates of Sheol,” the place of the dead. Murdock writes “the gates of death.” The assembly is ܥܕܬܝ, “my assembly.”",
  "matthew.27.46":
    "ܐܝܠ ܐܝܠ ܠܡܢܐ ܫܒܩܬܢܝ — “Eli, Eli, why have you forsaken me?” Murdock translates the cry “O God, O God,” and keeps the sounds in his footnote. ܠܡܢܐ is “why.” ܫܒܩܬܢܝ is “you have left me.”",
  "matthew.28.19":
    "ܐܥܡܕܘ is the causative of “to stand”: make them stand, confirm them. The English reads “immerse.” It is done ܒܫܡ, “in the name,” singular, of the Father and the Son and the Ruach haKodesh.",
  "mark.5.41":
    "ܛܠܝܬܐ ܩܘܡܝ — “little girl, arise.” The Greek of Mark already transliterates this Aramaic. Here it is simply the language of the verse. Murdock: “Maiden, arise.”",
  "mark.7.34":
    "The word the Greek spells ephphatha is the Syriac ܐܬܦܬܚ, “be opened.”",
  "mark.16.8":
    "In the oldest Greek copies Mark ends with the women’s fear, at verse 8. This Peshitta text goes on through verse 20.",
  "mark.16.9":
    "The longer ending is present in this edition: he arose on the first of the week and appeared first to Mary Magdalene. The charge in 16:15–18 is marked as his voice, because this edition prints those verses.",
  "luke.23.34":
    "The Peshitta includes the prayer, ܐܒܐ ܫܒܘܩ ܠܗܘܢ — “Father, forgive them.” Some Greek copies omit it. ܫܒܘܩ is the same root as the debts in the prayer: let it go, forgive. This edition prints the line, so the words are marked as his.",
  "luke.23.43":
    "ܝܘܡܢܐ ܥܡܝ ܬܗܘܐ ܒܦܪܕܝܣܐ — “today you shall be with me in paradise.” In the Syriac, “today” stands with “you shall be,” not with “I say to you.”",
  "john.1.1":
    "ܡܠܬܐ, miltha, is a word, a matter, the expression of a person. The last clause is ܘܐܠܗܐ ܐܝܬܘܗܝ ܗܘܐ ܗܘ ܡܠܬܐ — “and Elohim was the Word.” Syriac has no indefinite article. The pronoun ܗܘ points back to the Word. Elohim stands first for force. It is not a second, lesser one.",
  "john.1.14":
    "ܘܡܠܬܐ ܒܣܪܐ ܗܘܐ — “and the miltha became flesh.” ܘܐܓܢ ܒܢ — “and he tabernacled among us,” he pitched his dwelling. Murdock keeps “tabernacled.” The only one is ܝܚܝܕܝܐ, and the fullness is grace and ܩܘܫܬܐ, truth.",
  "john.3.16":
    "ܠܒܪܗ ܝܚܝܕܝܐ — “his only son.” ܚܝܐ ܕܠܥܠܡ is life of the age, which Murdock writes “life eternal.” The verb “perish” is ܢܐܒܕ. The words in red stop at 3:15. Verses 16–21 are the evangelist, not the voice of Y'shua.",
  "john.7.53":
    "Murdock’s own note is on this verse: it is missing in many early Syriac editions, and so is the story of the adulteress in the next chapter. The British and Foreign text printed here does include John 7:53–8:11. Read his footnote beside the Syriac.",
  "john.8.58":
    "The last words are ܐܢܐ ܐܝܬܝ — “I am,” the existential, not a past-tense verb. The clause is “before Avraham was, I am.”",
  "john.19.30":
    "ܗܐ ܡܫܠܡ — “Look, it is finished.” That one word, meshallam, is completed, fulfilled.",
  "john.20.28":
    "ܡܪܝ ܘܐܠܗܝ — “my Master and my Elohim.” Toma says both to Y'shua. ܐܠܗܝ is “my Elohim,” Alaha with the suffix.",
  "acts.2.38":
    "ܒܫܡܗ ܕܡܪܝܐ ܝܫܘܥ — “in the name of Master YHWH Y'shua.” The purpose is ܠܫܘܒܩܢ ܚܛܗܐ, “for the forgiveness of sins,” and the promise is ܡܘܗܒܬܐ, the gift of the Ruach haKodesh. The speaker is Shimon.",
  "acts.26.14":
    "The voice spoke ܥܒܪܐܝܬ, “in Hebrew.” In the first century that word often means the Jewish speech of the land, Aramaic, rather than biblical Hebrew. The cry is ܫܐܘܠ ܫܐܘܠ, Shaul, Shaul.",
  "philippians.2.6":
    "ܒܕܡܘܬܐ ܕܐܠܗܐ — “in the likeness of Elohim.” The Greek word there is morphē, form; the Syriac chose dmuta, likeness. ܚܛܘܦܝܐ is a thing seized, a robbery, the word behind Greek harpagmon. ܦܚܡܐ ܕܐܠܗܐ is “the equal of Elohim.”",
  "1john.4.8":
    "ܐܠܗܐ ܚܘܒܐ ܗܘ — “Elohim is love.” The pronoun ܗܘ marks the identification. Whoever does not love, ܠܐ ܡܚܒ, does not know Elohim.",
  "1john.5.7":
    "The Syriac line here is about the Spirit who testifies, because the Spirit is the truth. It is not the “three heavenly witnesses.” Murdock printed that later sentence in italics at this verse number, and his footnote says it is missing in most manuscripts and was omitted in the London edition of 1826. The italics are his warning. The Syriac beside them is the Peshitta.",
  "2peter.1.1":
    "Second Peter was not part of the original Peshitta, the twenty-two-book New Testament of the Syriac churches. The text in this edition is the later Syriac translation, as printed by the Bible Society.",
  "jude.1.1":
    "Jude was outside the original Peshitta canon. What you are reading is the later Syriac of the book, set beside the English of this edition.",
  "revelation.1.1":
    "Revelation was outside the original Peshitta. The Syriac is John Gwynn’s edition of the Crawford manuscript, the text the Bible Society printed in 1905, not the Peshitta proper. ܓܠܝܢܐ is “revelation.”",
  "revelation.1.8":
    "The verse names the speaker Master YHWH Elohim, he who is and who was and who is coming. This edition does not mark it as the voice of Y'shua. His voice in the opening vision is 1:11 and 1:17–20.",
  "revelation.21.6":
    "These words continue the one who sits on the throne in 21:5. This edition does not mark 21:5–7 as the voice of Y'shua. The same restraint is at 1:8, where the speaker is named Master YHWH Elohim.",
};
