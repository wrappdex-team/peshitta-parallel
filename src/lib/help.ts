/** One sentence for the mark beside a control. The rest is in the guide. */

export type HelpTip = {
  title: string;
  /** Hash on /guide. */
  section: string;
  line: string;
};

export const HELP: Record<string, HelpTip> = {
  edition: {
    title: "The text",
    section: "edition",
    line: "The Syriac is the text. Every other column is a reading of it.",
  },
  open: {
    title: "Injeel",
    section: "edition",
    line: "Injeel is the Syriac word ܐܘܢܓܠܝܘܢ, “good news.” This book is the New Testament in classical Syriac, a literary Aramaic, in the Peshitta text kept by the churches of the East. The older Peshitta is twenty-two books: the four Gospels, Acts, Paul, Hebrews, James, 1 Peter, and 1 John. 2 Peter, 2 John, 3 John, Jude, and Revelation were put into Syriac later, and the book list marks them rather than folding them into that older collection. The Syriac line is the text. English and the other languages are translations of that Syriac, and the names stay with the spelling in this book: Y'shua, Maryam, Keefa, Mashiyach.",
  },
  reading: {
    title: "Set the page",
    section: "reading",
    line: "Stays with the chapter. A new device opens in one language. Notes are off.",
  },
  red: {
    title: "Red type",
    section: "red",
    line: "Red marks words Y'shua speaks, including scripture he quotes.",
  },
  word: {
    title: "A Syriac word",
    section: "word",
    line: "The form is the word in the verse. A gloss does not replace the verse.",
  },
  names: {
    title: "Names",
    section: "names",
    line: "The reading is the Syriac letters. It is not a pronunciation, and not a translation.",
  },
  notes: {
    title: "Edition notes",
    section: "notes",
    line: "An edition note is on the wording. It is not a second translation.",
  },
  marks: {
    title: "Marks on a verse",
    section: "marks",
    line: "Mark cycles gold, then garnet, then ink, then off.",
  },
  search: {
    title: "Search",
    section: "search",
    line: "The letters you type choose which text is searched. The list stops at forty.",
  },
  aloud: {
    title: "Read aloud",
    section: "aloud",
    line: "Read uses a voice already on this device. Syriac is not one of them.",
  },
  sayings: {
    title: "Words of Y'shua",
    section: "sayings",
    line: "These lines are the red type in the Gospels, Acts, and Revelation.",
  },
  record: {
    title: "Your reading",
    section: "record",
    line: "A chapter is kept when its last line is on screen, or when the voice finishes it.",
  },
  studio: {
    title: "Studio",
    section: "studio",
    line: "Studio sends a passage and a key you supply. Read does not.",
  },
  device: {
    title: "This device",
    section: "device",
    line: "The record stays in this browser. There is no account.",
  },
  saved: {
    title: "Saved",
    section: "marks",
    line: "Marks, saves, and notes from this browser. They are not an account.",
  },
  offline: {
    title: "Offline",
    section: "device",
    line: "One language, stored in this browser: a chapter, a book, or the whole New Testament. The Syriac is not included.",
  },
};
