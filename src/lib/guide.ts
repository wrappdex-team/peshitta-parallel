/** How to use the reader. Labels match the controls on the page. */

export type GuideRow = { term: string; text: string; to?: "/study" | "/privacy" | "/names" | "/words" | "/seal" };

export type GuideSection = {
  id: string;
  title: string;
  lead: string;
  rows?: GuideRow[];
  notes?: string[];
};

export const GUIDE: GuideSection[] = [
  {
    id: "edition",
    title: "The text",
    lead: "The Syriac on the page is the text of this reader. Everything else is a way of reading it.",
    rows: [
      {
        term: "Peshitta",
        text: "The Syriac New Testament. The old collection is twenty-two books: the four Gospels, Acts, Romans through Philemon, Hebrews, James, 1 Peter, and 1 John.",
      },
      {
        term: "Later Syriac",
        text: "2 Peter, 2 John, 3 John, Jude, and Revelation were translated into Syriac later. The book list marks them. Revelation follows John Gwynn’s edition of the Crawford manuscript. They are in the reader. They are not silently added to the old twenty-two.",
      },
      {
        term: "English",
        text: "The English of this reader, and the default second column. It keeps the names close to the Syriac spelling in this book: Y'shua, Maryam, Keefa, Mashiyach, Elohim. John 1:1 reads “Elohim was the Word.” Where a note names Murdock, it is citing his 1850s translation or his footnote on that verse, not labeling this column as his.",
      },
      {
        term: "Other languages",
        text: "Modern readings of this Syriac: Ελληνικά, עברית, العربية, Français, Русский, Español, 中文, Sureth, Deutsch, 日本語. The Greek and the Hebrew are contemporary. They are not Koine, and they are not the Hebrew of the prophets. Where a later Greek copy differs, these lines stay with the Syriac.",
      },
      {
        term: "Names",
        text: "The English keeps the names close to the Syriac spelling in this book: Y'shua, Maryam, Keefa, Mashiyach, Elohim. The name index says when one spelling covers more than one person.",
      },
    ],
  },
  {
    id: "open",
    title: "Open a book",
    lead: "Home is the shelf. A chapter is the page.",
    rows: [
      {
        term: "Continue",
        text: "The card at the top of Home returns to the last verse stored on this device. A new device opens John 1.",
      },
      {
        term: "The list",
        text: "Books are grouped as Gospels, Acts, Paul, Letters, and Apocalypse. A line that says “later Syriac” is one of the five later books. A line that says “chapter N still open” is the first chapter of that book you have not yet kept.",
      },
      {
        term: "Books",
        text: "The menu at the top left. The same shelf, plus Words of Y'shua, the name index, About, Share, Home, and this guide. Inside a chapter it keeps your place in the book you already have open.",
      },
      {
        term: "Chapter numbers",
        text: "The row under the title. The filled number is the chapter you are in. The row does not move by itself; scroll it to a later chapter.",
      },
      {
        term: "Previous and Next",
        text: "One chapter back or forward, from the top of the chapter.",
      },
    ],
  },
  {
    id: "reading",
    title: "Set the page",
    lead: "The line under the title begins “Reading”. Tap it. That sheet is where the page is set. The same sheet is on Words of Y'shua.",
    rows: [
      { term: "Text", text: "The Syriac on the page." },
      { term: "Reading", text: "The language beside the Syriac, or in its place." },
      { term: "Gloss", text: "The line under a Syriac word. It does not replace the verse." },
      { term: "Edition note", text: "A note on the wording, shown when Notes are on." },
      { term: "Your note", text: "The line you write on a verse. Shown when Notes are on. It stays on this device." },
      { term: "Both", text: "Syriac, and the language you chose." },
      { term: "Peshitta", text: "Syriac only." },
      { term: "The language name", text: "That language only. The button uses the name of the language, not the word “translation”." },
      { term: "Words", text: "Syriac word buttons under the verse. Turn this off when you want the line unbroken." },
      { term: "Notes", text: "Edition notes on the wording, the short note at the start of a book, and a note you wrote on a verse." },
      { term: "A− and A+", text: "Five sizes of type." },
      { term: "The line buttons", text: "Three settings for the space between lines. The labels are “Tighter lines” and “Looser lines”." },
      {
        term: "Language",
        text: "The tongue beside the Syriac, or in its place. Eleven are listed. Choosing the language that is already in Also clears Also.",
      },
      {
        term: "Also",
        text: "A second language in the same verse. None removes it. The page widens to hold both.",
      },
      { term: "Day and night", text: "The sun or moon in the header. Stored on this device. It does not change the text." },
    ],
  },
  {
    id: "red",
    title: "Red type",
    lead: "Red is a reading mark, not a second text. It marks words Y'shua speaks, including scripture he quotes.",
    notes: [
      "Not red: the narrator, other speakers, the Father, angels, and Satan.",
      "In a mixed verse, only his English clauses are red. The Syriac line is fully red only when the whole verse is his. Where the Syriac can be split, only his clauses are red.",
      "The Words of Y'shua page collects those lines from the Gospels, from Acts, and from Revelation. The letters are not in that index.",
      "Read aloud speaks the verse as printed, including the frame around his words.",
    ],
  },
  {
    id: "word",
    title: "A Syriac word",
    lead: "With Words on, each Syriac word is a button. Tap it.",
    rows: [
      { term: "The form", text: "The word as it stands in the verse, then a gloss when one is settled. Where none is settled, the line says so." },
      { term: "Build", text: "Prefix, stem, and ending, when the word has them. A bare word is marked “form”." },
      { term: "Play", text: "A reading in the device voice. It does not start while a chapter is already being read." },
      { term: "Root and cognates", text: "Shown when the lexicon has them. A cognate is a related form, not a claim that the verse means the cognate." },
    ],
    notes: ["A gloss is a study note on one word. It does not replace the verse."],
  },
  {
    id: "names",
    title: "Names",
    lead: "A name in the text opens the name index at that entry. The index is also on Home, and in Books.",
    rows: [
      { term: "Find a name", text: "Matches the English of this book, a familiar English form, the Syriac, the letter-reading, and the note. The list is the whole index. It does not stop at forty." },
      { term: "The reading", text: "The letters of the Syriac spelling. It is not a vocalized pronunciation and not another translation." },
      { term: "Kind", text: "Person, place, or people. Where one spelling covers more than one person, the note says whom this book distinguishes." },
    ],
  },
  {
    id: "notes",
    title: "Edition notes",
    lead: "Notes in the Reading sheet turn these on. They are notes on the wording, not a second translation.",
    notes: [
      "A note is tied to a verse. It appears with that verse.",
      "On the first chapter of a book, the short line about that book is shown under the chapter when Notes are on.",
      "Your own note is separate. It is the Note button on the verse, and it is shown only when Notes are on.",
    ],
  },
  {
    id: "marks",
    title: "Marks on a verse",
    lead: "Each verse has the same three marks, then Share, Copy, and Link. They stay in this browser.",
    rows: [
      { term: "Highlight", text: "Cycles three grounds: gold, then garnet, then ink, then off. There is no legend on the page. Those are the three steps, in that order." },
      { term: "Bookmark", text: "Marks the verse. There is no separate list of bookmarks. The mark remains on the verse." },
      { term: "Note", text: "A line you write. Stored on this device. Shown when Notes are on." },
      { term: "Share", text: "Sends the verse by the share sheet on this device, or copies it if the device cannot share." },
      { term: "Copy", text: "Puts the verse text on the clipboard." },
      { term: "Link", text: "Copies the address of that verse." },
    ],
  },
  {
    id: "search",
    title: "Search",
    lead: "Search is the magnifying glass in the header, on Home and in a chapter. It searches the text, not the name index.",
    rows: [
      { term: "Two characters", text: "Fewer than two characters returns nothing. The field says so." },
      {
        term: "Which index",
        text: "The letters you type choose the index. Syriac letters search the Peshitta line, not the Sureth reading. Hebrew, Arabic, Greek, and Cyrillic search those readings. A query that contains French accented letters searches the French. Plain Latin letters search the English. Spanish, German, Chinese, and Japanese are page languages only. They have no separate index.",
      },
      { term: "Forty", text: "The list stops at forty matches. Narrow the word if the one you want is not in the first forty." },
    ],
  },
  {
    id: "aloud",
    title: "Read aloud",
    lead: "The bar at the bottom of a chapter, and of Words of Y'shua. It uses a voice already on this device. Injeel does not install voices.",
    rows: [
      { term: "Read", text: "Starts at the beginning of the chapter, or from the verse you last had open. On Words of Y'shua it reads the sayings." },
      { term: "Pause and Resume", text: "Hold the place, then continue it. The voice is still in session. Other speech on the page waits." },
      { term: "Stop", text: "Ends the session and clears the place." },
      { term: "Continue", text: "When it reads “Continuing”, the voice goes into the next chapter and the next book. When it reads “Continue”, the voice stops at the end of this chapter." },
      { term: "Voice", text: "“Automatic language match” picks a device voice for the language on the page. You may choose a listed voice instead. The list is what this browser exposes, which is not always every voice installed on the phone." },
      { term: "Speed", text: "From 50 to 150. One hundred is the device’s ordinary rate." },
      { term: "Leaving the page", text: "The voice keeps going across the site until Stop. Pause and Stop stay on the bar." },
      { term: "Corner", text: "Where the browser allows it. Keeps the screen awake and can show a small player. It stays on the device." },
      { term: "Voice setup help", text: "Under the bar. Paths for iPhone, Android, and Mac. Syriac is not a system speech language." },
    ],
    notes: [
      "A chapter is kept when its last line is on screen, or when the voice finishes it. The same chapter inside one minute is counted once.",
    ],
  },
  {
    id: "sayings",
    title: "Words of Y'shua",
    lead: "A separate page from the chapter. The strip of book names is Matthew, Mark, Luke, John, Acts, and Revelation.",
    rows: [
      { term: "A line", text: "The reference opens that verse in the chapter. Share sends the line." },
      { term: "Reading", text: "The same language sheet as in a chapter. Read on the bottom bar speaks the sayings in order, and can continue into the next of these books." },
      { term: "What is not here", text: "The letters are not indexed on this page. Red type inside a letter, where it exists, is still marked in the chapter." },
    ],
  },
  {
    id: "record",
    title: "Your reading",
    lead: "Home links here. The record is on this device. There is no account, and the chapters are not sent anywhere.",
    rows: [
      { term: "A chapter", text: "Kept when you reach its last line, or when the voice finishes it. Opening a chapter is not enough." },
      { term: "Still open", text: "The first chapter in that book whose count is still the lowest. Read that chapter through once if the percentage skipped it." },
      { term: "The seal", text: "A mark for reading the whole New Testament, then further marks as the page states them. It is separate from the four Gospels." },
      { term: "The declaration", text: "When Matthew, Mark, Luke, and John are all kept, the sheet can be opened from this page. A name is optional. The name stays on this device. Nothing is uploaded, and the books stay open if you do not sign. Share and Download appear after you keep it." },
    ],
  },
  {
    id: "studio",
    title: "Studio",
    lead: "Optional, and separate from Read. Books, and the Reading sheet, both say “Studio · AI voice and images” or “Studio · premium”.",
    notes: [
      "Studio sends the passage and a key you supply to a provider. Read does not.",
      "The key is held for the tab. It is not a permanent vault. Privacy states what is stored, what may be charged, and what clearing the key does and does not do.",
      "You can read the whole book and never open Studio.",
    ],
  },
  {
    id: "device",
    title: "This device",
    lead: "No account. Clearing the site’s data in the browser clears the record.",
    rows: [
      { term: "Stored here", text: "Last verse, languages, type size, day or night, highlights, bookmarks, your notes, chapters kept, whether Help is on, and a declaration if you kept one." },
      { term: "Not stored by Injeel", text: "A name on the declaration is not uploaded. Corner and the device voice stay on the phone. Studio is the exception, and only when you submit a passage with a key." },
      { term: "Install", text: "When the browser offers it, Home shows Install. The installed reader is the same site. It does not collect anything more." },
      { term: "About", text: "“About this Injeel” is an essay on the book. It is not this guide.", to: "/study" },
      { term: "Privacy", text: "The full statement of what stays here and what Studio does.", to: "/privacy" },
    ],
  },
];
