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

export const STEPS: { kicker: string; title: string; body: string }[] = [
  {
    kicker: "The book",
    title: "This is the Injeel",
    body: "You are opening the New Testament the Syriac churches read, the Peshitta. A living tongue sits beside it — English, and whichever other tongue you choose. The names stay as they were carried: Y'shua, Maryam, Keefa, Elohim, Mashiyach. This is a desk, not a museum.",
  },
  {
    kicker: "The page",
    title: "Two tongues, one line",
    body: "The Syriac is the text. Choose English alone, or open a second tongue beside it: contemporary Greek, contemporary Hebrew, Arabic, and the others. Where a later Greek copy and the Peshitta part company, these lines stay with the Syriac. Five books came into Syriac later. The reader marks them. Do not let that appendix distract you from the gospel.",
  },
  {
    kicker: "A word",
    title: "Touch the Syriac",
    body: "A Syriac word is a quiet button. It looks like the text. Open it and you see how the word is built: what was added in front, the stem, and the consonants of the root. You can hear that word in the tongues you have open. Play one, or play them in order. This is how a student learns a line, not only a chapter.",
  },
  {
    kicker: "His voice",
    title: "The lines in red",
    body: "Where Y'shua speaks, the words are marked. They are not a decoration. The page called Words of Y'shua gathers those lines in the order this book keeps them, so you can hear him without hunting. He does not talk like a mascot. He says he is the way, the truth, and the life.",
  },
  {
    kicker: "The shelf",
    title: "What you are opening",
    body: "Four gospels are four portraits of one Mashiyach, not four arguments. Acts is what happened after the tomb was empty. The letters of Paulos are pastoral care sent to real assemblies. Timothy and Titus are charges to shepherds. The other letters are further voices to the same churches. Revelation is an unveiling for a church under pressure, not a puzzle meant to frighten you. The helper in the corner will open each of these more slowly.",
  },
  {
    kicker: "The voice",
    title: "Let it be read",
    body: "At the foot of a chapter there is a bar that reads aloud, in the tongue you chose, with the voice on this device. You may pause, continue, or stop. It will follow the line. Hearing a chapter is a fair way to begin, especially if the Syriac is new to your eye.",
  },
  {
    kicker: "Begin",
    title: "The mark stays",
    body: "This walk will not follow you. The small chevron in the corner will. Open it when you want today’s bread, the map of the books, or this guide again. Come and see.",
  },
];

export const FAMILIES: { id: string; title: string; books: string; body: string }[] = [
  {
    id: "gospels",
    title: "The four Gospels",
    books: "Matthew, Mark, Luke, John",
    body: "These are four witnesses, not four lawsuits. Each was written for people who needed to see the Mashiyach from where they stood. Matthew sets him in the line of the promises, and the subscription says he published it in the land. Mark moves like a proclamation, and this edition keeps the longer ending. Luke writes an ordered account, from the hymns of the infancy to the road and the table. John stays with the Word who was with Elohim, and who was Elohim, and who became flesh. Hang the four portraits in one room. A change of angle is not a contradiction.",
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
