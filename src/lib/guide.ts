export const WELCOME_KEY = "injeel-welcome";
export const GUIDE_KEY = "injeel-guide";

export type Bread = { line: string; from: string };

/** Short lines this edition actually keeps. The day of the year picks one. */
export const BREADS: Bread[] = [
  {
    line: "In the beginning was the Word, and the Word was with Elohim, and Elohim was the Word.",
    from: "John 1:1",
  },
  {
    line: "The bread asked for in the prayer is the bread of our need, today. A chapter is enough.",
    from: "Matthew 6:11",
  },
  {
    line: "You are Keefa, and on this keefa I will build my assembly. In this tongue the name and the stone are one word.",
    from: "Matthew 16:18",
  },
  {
    line: "No one has ever seen Elohim. The only begotten Elohim, who is in the bosom of the Father, has declared him.",
    from: "John 1:18",
  },
  {
    line: "The Spirit testifies that the Spirit is the truth. This letter does not add a later sentence about three witnesses in heaven.",
    from: "1 John 5:7",
  },
  {
    line: "He rose on the morning of the first day, and he appeared first to Maryam Magdalitha. The longer ending is in this book.",
    from: "Mark 16:9",
  },
  {
    line: "Eli, Eli, why have you forsaken me? The cry is kept in the language of the land. Do not hurry past it.",
    from: "Matthew 27:46",
  },
];

export function breadFor(date = new Date()): Bread {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  return BREADS[((day % BREADS.length) + BREADS.length) % BREADS.length];
}

export function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Private mode can refuse the write. The sheet still closes for this visit.
  }
}

export const STEPS: {
  kicker: string;
  title: string;
  body: string;
  say: { line: string; from: string; book: string; chapter: string };
}[] = [
  {
    kicker: "What this is",
    title: "Injeel is the New Testament in Syriac",
    body: "The Peshitta is the Syriac New Testament, the Aramaic text these churches have kept. By the early 400s they were reading twenty-two books: the Gospels, Acts, Paul's letters, Hebrews, James, 1 Peter, and 1 John. 2 Peter, 2 John, 3 John, Jude, and Revelation were translated into Syriac later, and this reader marks them. The English beside it is James Murdock's, from the 1850s. Names stay close to the original: Y'shua, Maryam, Keefa, Mashiyach.",
    say: {
      line: "Search the scriptures; for in them you think there is life eternal for you; and they testify of me.",
      from: "John 5:39",
      book: "john",
      chapter: "5",
    },
  },
  {
    kicker: "How to read",
    title: "Tap a book, then a chapter",
    body: "Open any book. Switch languages if you want. Red text is where Y'shua is speaking. The chevron in the corner opens this help again.",
    say: {
      line: "My sheep hear my voice, and I know them, and they come after me.",
      from: "John 10:27",
      book: "john",
      chapter: "10",
    },
  },
  {
    kicker: "A closer look",
    title: "Touch a word, or hear the chapter",
    body: "Tap a Syriac word to see its root and hear it. At the bottom of a chapter you can play the whole reading in the language you chose.",
    say: {
      line: "It is written that man does not live by bread alone, but by every word that goes out from the mouth of Elohim.",
      from: "Matthew 4:4",
      book: "matthew",
      chapter: "4",
    },
  },
  {
    kicker: "Why it is here",
    title: "Come and see for yourself",
    body: "These are the words about Y'shua the Mashiyach, who taught, died, and rose. Start with John 1 or Matthew 5.",
    say: {
      line: "I am the resurrection and the life. Whoever believes in me, even if he dies, will live.",
      from: "John 11:25",
      book: "john",
      chapter: "11",
    },
  },
];

export const FAMILIES: { id: string; title: string; books: string; body: string }[] = [
  {
    id: "gospels",
    title: "The four Gospels",
    books: "Matthew, Mark, Luke, John",
    body: "These are four witnesses. Each was written for people who needed to see the Mashiyach from where they stood. Matthew sets him in the line of the promises, and the subscription says he published it in the land. Mark moves like a proclamation, and this edition keeps the longer ending. Luke writes an ordered account, from the hymns of the infancy to the road and the table. John stays with the Word who was with Elohim, and who was Elohim, and who became flesh.",
  },
  {
    id: "acts",
    title: "Acts",
    books: "The Acts of those who were sent",
    body: "After the tomb is empty, the story does not become an idea. Acts is the history of the sent ones: the Spirit given, the assembly in Urishlim, the road out to the nations. Read it as events. The Church is born in these chapters, not invented in a later century to win an argument.",
  },
  {
    id: "paul",
    title: "The letters of Paulos",
    books: "Romans through Philemon, apart from the charges",
    body: "These are letters, sent to assemblies that already believed. Rome hears how a person is set right with Elohim. Corinth is corrected at the table and at the resurrection. Galatia is called back from a law that cannot give life. Ephesus, Philippi, Colossae, and Thessalonica each receive a word for their own trouble. Philemon is one chapter, about a man named Onesimus. Read a letter as a letter. It was not written to you first. It was kept so that you could hear it.",
  },
  {
    id: "pastorals",
    title: "The pastoral charges",
    books: "1 Timothy, 2 Timothy, Titus",
    body: "These three are not a different gospel. They are charges to shepherds. Paulos tells Timothy and Titus how to guard an assembly, what sort of elder to appoint, and how to hold the sound word when another teaching arrives. Read them as instructions to a man who has to stay when the apostle cannot.",
  },
  {
    id: "letters",
    title: "The other letters",
    books: "Hebrews, James, Peter, John, Jude",
    body: "Other voices, to the same churches. Hebrews, which leaves its writer unnamed, sets the Mashiyach above the offerings. Ya'akov will not let faith sit still. The first letter of Keefa is written to exiles, and it belongs to the old Peshitta. The first letter of Yochanan speaks of light, love, and the Word of life, and it does not carry the later sentence about three heavenly witnesses. Second Peter, the two short letters of Yochanan, and Yehuda came into Syriac afterward. This reader marks them. The gospel was not waiting on that appendix.",
  },
  {
    id: "apocalypse",
    title: "Revelation",
    books: "The unveiling",
    body: "Do not open this book as a code. It is a vision given to assemblies under pressure: the Lamb who was slain is the one who reigns. The Syriac here is later than the old Peshitta, from the Crawford manuscript. Read it as the last word of the same witness, not as a fear beside the gospel.",
  },
];
