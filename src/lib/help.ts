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
    title: "The shelf",
    section: "open",
    line: "Continue is the last verse on this device. A new device opens John 1.",
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
};
