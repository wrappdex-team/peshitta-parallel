type Range = [number, number, number];

/** Whole verses that are his voice, narrative frame included. [chapter, from, to]. */
const RANGES: Record<string, Range[]> = {
  matthew: [
    [3, 15, 15], [4, 4, 4], [4, 7, 7], [4, 10, 10], [4, 17, 17], [4, 19, 19],
    [5, 3, 48], [6, 1, 34], [7, 1, 27],
    [8, 3, 4], [8, 7, 7], [8, 10, 13], [8, 20, 20], [8, 22, 22], [8, 26, 26], [8, 32, 32],
    [9, 2, 2], [9, 4, 6], [9, 9, 9], [9, 12, 13], [9, 15, 17], [9, 22, 22], [9, 24, 24], [9, 28, 30], [9, 37, 38],
    [10, 5, 42],
    [11, 4, 30],
    [12, 3, 8], [12, 11, 13], [12, 25, 37], [12, 39, 45], [12, 48, 50],
    [13, 3, 9], [13, 11, 52],
    [14, 16, 16], [14, 18, 18], [14, 27, 27], [14, 29, 29], [14, 31, 31],
    [15, 3, 11], [15, 13, 14], [15, 16, 20], [15, 24, 24], [15, 26, 26], [15, 28, 28], [15, 32, 32], [15, 34, 34],
    [16, 2, 4], [16, 6, 6], [16, 8, 11], [16, 13, 13], [16, 15, 15], [16, 17, 19], [16, 23, 28],
    [17, 7, 7], [17, 9, 9], [17, 11, 12], [17, 17, 17], [17, 20, 22], [17, 25, 27],
    [18, 3, 20], [18, 22, 35],
    [19, 4, 6], [19, 8, 9], [19, 11, 12], [19, 14, 14], [19, 17, 19], [19, 21, 21], [19, 23, 24], [19, 26, 26], [19, 28, 30],
    [20, 1, 16], [20, 18, 19], [20, 22, 23], [20, 25, 28], [20, 32, 32],
    [21, 2, 3], [21, 13, 13], [21, 16, 16], [21, 19, 19], [21, 21, 21], [21, 24, 24], [21, 27, 44],
    [22, 2, 14], [22, 18, 21], [22, 29, 32], [22, 37, 40], [22, 43, 45],
    [23, 2, 39],
    [24, 2, 2], [24, 4, 51],
    [25, 1, 46],
    [26, 2, 2], [26, 10, 13], [26, 18, 18], [26, 21, 21], [26, 23, 29], [26, 31, 32], [26, 34, 34], [26, 36, 36], [26, 38, 42], [26, 45, 46], [26, 50, 50], [26, 52, 56], [26, 64, 64],
    [27, 46, 46],
    [28, 9, 10], [28, 18, 20],
  ],
  mark: [
    [1, 15, 15], [1, 17, 17], [1, 25, 25], [1, 38, 38], [1, 41, 44],
    [2, 5, 5], [2, 8, 11], [2, 14, 14], [2, 17, 17], [2, 19, 22], [2, 25, 28],
    [3, 3, 5], [3, 23, 29], [3, 33, 35],
    [4, 3, 9], [4, 11, 32], [4, 35, 35], [4, 39, 40],
    [5, 8, 9], [5, 19, 19], [5, 34, 34], [5, 36, 36], [5, 39, 41],
    [6, 4, 4], [6, 10, 11], [6, 31, 31], [6, 37, 38], [6, 50, 50],
    [7, 6, 16], [7, 18, 23], [7, 27, 27], [7, 29, 29], [7, 34, 34],
    [8, 5, 5], [8, 12, 12], [8, 15, 21], [8, 26, 26], [8, 33, 38],
    [9, 1, 1], [9, 12, 13], [9, 16, 16], [9, 19, 19], [9, 21, 23], [9, 25, 25], [9, 29, 29], [9, 31, 31], [9, 35, 50],
    [10, 3, 3], [10, 5, 9], [10, 11, 12], [10, 14, 15], [10, 18, 21], [10, 23, 25], [10, 27, 31], [10, 33, 34], [10, 36, 40], [10, 42, 45], [10, 49, 52],
    [11, 2, 3], [11, 14, 14], [11, 17, 17], [11, 22, 26], [11, 29, 30], [11, 33, 33],
    [12, 1, 11], [12, 15, 17], [12, 24, 27], [12, 29, 31], [12, 34, 40], [12, 43, 44],
    [13, 2, 2], [13, 5, 37],
    [14, 6, 9], [14, 13, 15], [14, 18, 18], [14, 20, 25], [14, 27, 28], [14, 30, 30], [14, 32, 32], [14, 34, 38], [14, 41, 42], [14, 48, 49], [14, 62, 62],
    [15, 34, 34],
    [16, 15, 18],
  ],
  luke: [
    [2, 49, 49],
    [4, 4, 4], [4, 8, 8], [4, 12, 12], [4, 18, 19], [4, 21, 21], [4, 23, 27], [4, 35, 35], [4, 43, 43],
    [5, 4, 4], [5, 10, 10], [5, 13, 14], [5, 20, 20], [5, 22, 24], [5, 27, 27], [5, 31, 32], [5, 34, 39],
    [6, 3, 5], [6, 8, 10], [6, 20, 49],
    [7, 9, 9], [7, 13, 14], [7, 22, 23], [7, 24, 28], [7, 31, 35], [7, 40, 48], [7, 50, 50],
    [8, 5, 8], [8, 10, 18], [8, 21, 22], [8, 25, 25], [8, 30, 30], [8, 39, 39], [8, 45, 46], [8, 48, 48], [8, 50, 52],
    [9, 3, 5], [9, 13, 14], [9, 18, 18], [9, 20, 22], [9, 24, 27], [9, 41, 44], [9, 48, 50], [9, 55, 56], [9, 58, 62],
    [10, 2, 16], [10, 18, 24], [10, 26, 28], [10, 30, 37], [10, 41, 42],
    [11, 2, 13], [11, 17, 26], [11, 28, 36], [11, 39, 52],
    [12, 1, 59],
    [13, 2, 9], [13, 12, 12], [13, 15, 16], [13, 18, 21], [13, 24, 35],
    [14, 3, 6], [14, 8, 14], [14, 16, 35],
    [15, 3, 32],
    [16, 1, 13], [16, 15, 18], [16, 25, 31],
    [17, 1, 10], [17, 14, 14], [17, 17, 37],
    [18, 2, 8], [18, 14, 14], [18, 16, 17], [18, 19, 22], [18, 24, 27], [18, 29, 33], [18, 41, 42],
    [19, 5, 5], [19, 9, 10], [19, 12, 27], [19, 30, 31], [19, 40, 46],
    [20, 3, 4], [20, 8, 8], [20, 9, 18], [20, 23, 25], [20, 34, 38], [20, 41, 44], [20, 46, 47],
    [21, 3, 4], [21, 6, 6], [21, 8, 36],
    [22, 8, 12], [22, 15, 22], [22, 25, 38], [22, 40, 42], [22, 46, 46], [22, 48, 48], [22, 51, 53], [22, 67, 70],
    [23, 28, 31], [23, 34, 34], [23, 43, 43], [23, 46, 46],
    [24, 17, 17], [24, 19, 19], [24, 25, 26], [24, 36, 36], [24, 38, 39], [24, 41, 41], [24, 44, 49],
  ],
  john: [
    [1, 38, 39], [1, 42, 43], [1, 47, 51],
    [2, 4, 4], [2, 7, 8], [2, 16, 16], [2, 19, 19],
    [3, 3, 3], [3, 5, 8], [3, 10, 15],
    [4, 7, 7], [4, 10, 10], [4, 13, 14], [4, 16, 18], [4, 21, 24], [4, 26, 26], [4, 32, 38], [4, 48, 50], [4, 53, 53],
    [5, 6, 8], [5, 14, 14], [5, 17, 17], [5, 19, 47],
    [6, 5, 5], [6, 10, 12], [6, 20, 20], [6, 26, 27], [6, 29, 29], [6, 32, 40], [6, 43, 58], [6, 61, 65], [6, 67, 67], [6, 70, 70],
    [7, 6, 8], [7, 16, 19], [7, 21, 24], [7, 28, 29], [7, 33, 34], [7, 37, 38],
    [8, 7, 7], [8, 10, 19], [8, 21, 29], [8, 31, 32], [8, 34, 58],
    [9, 3, 5], [9, 7, 7], [9, 35, 35], [9, 37, 37], [9, 39, 41],
    [10, 1, 18], [10, 25, 30], [10, 32, 32], [10, 34, 38],
    [11, 4, 4], [11, 7, 11], [11, 14, 15], [11, 23, 23], [11, 25, 26], [11, 34, 34], [11, 39, 44],
    [12, 7, 8], [12, 23, 28], [12, 30, 36], [12, 44, 50],
    [13, 7, 10], [13, 12, 21], [13, 26, 27], [13, 31, 38],
    [14, 1, 31],
    [15, 1, 27],
    [16, 1, 33],
    [17, 1, 26],
    [18, 4, 8], [18, 11, 11], [18, 20, 21], [18, 23, 23], [18, 34, 37],
    [19, 11, 11], [19, 26, 28], [19, 30, 30],
    [20, 15, 17], [20, 19, 19], [20, 21, 23], [20, 26, 27], [20, 29, 29],
    [21, 5, 6], [21, 10, 12], [21, 15, 19], [21, 22, 23],
  ],
  acts: [
    [1, 5, 5], [1, 7, 8], [9, 5, 6], [9, 10, 12], [9, 15, 16], [18, 9, 10], [22, 7, 10], [22, 18, 18], [22, 21, 21], [23, 11, 11], [26, 14, 18],
  ],
  revelation: [
    [1, 11, 11], [1, 17, 20],
    [2, 1, 29],
    [3, 1, 22],
    [16, 15, 15],
    [22, 7, 7], [22, 12, 13], [22, 16, 16],
  ],
};

/** Inside a whole-verse range, but the verse is not his voice at all. */
const NOT_HIS = new Set([
  "matthew:13:34", "matthew:13:35", "matthew:13:36", "matthew:21:41",
  "mark:9:38", "mark:10:28", "mark:10:37",
  "luke:11:45", "luke:12:13", "luke:12:41", "luke:13:31", "luke:17:5", "luke:18:26", "luke:22:33",
  "john:6:34", "john:6:52", "john:8:13", "john:8:22", "john:8:48", "john:8:52", "john:8:53", "john:8:57",
  "john:9:40", "john:10:6", "john:11:8", "john:12:34", "john:13:9", "john:13:37",
  "john:14:5", "john:14:8", "john:14:22", "john:16:17", "john:16:18", "john:16:29", "john:16:30",
  "acts:22:19", "acts:22:20",
  // Another person, the whole verse. Not a line inside a parable he is telling.
  "mark:10:20", "luke:10:27", "luke:18:21",
]);

/**
 * Two voices in one verse. These English clauses are his; the rest of the verse is not.
 * The match is the printed English, in order.
 */
const CLAUSES: Record<string, string[]> = {
  "matthew:13:51": ["Have you understood all these things?"],
  "matthew:20:21": ["What do you want?"],
  "matthew:21:27": ["Neither do I tell you by what authority I do these things."],
  "matthew:21:31": [
    "Which of these two did the will of his father?",
    "Amen, I say to you that tax collectors and prostitutes go before you into the kingdom of Elohim.",
  ],
  "matthew:22:42": ["What do you say about the Mashiyach? Whose son is he?"],
  "matthew:26:25": ["You have said."],
  "matthew:27:11": ["You have said."],
  "mark:8:27": ["Who do men say about me that I am?"],
  "mark:8:29": ["But who do you say about me that I am?"],
  "mark:12:34": ["You are not far from the kingdom of Elohim."],
  "mark:15:2": ["You have said."],
  "luke:7:40": ["Shimon, I have something to say to you."],
  "luke:7:43": ["You have judged correctly."],
  "luke:17:37": ["Where the body is, there the eagles will assemble."],
  "luke:22:35": ["When I sent you without purse and without wallet and shoes, did you lack anything?"],
  "luke:22:38": ["They are enough."],
  "luke:23:3": ["You have said."],
  "luke:24:19": ["What?"],
  "john:1:38": ["What are you seeking?"],
  "john:4:17": ["You have said well, I have no husband;"],
  "john:4:53": ["Your son is alive."],
  "john:7:20": ["Why are you seeking to kill me?"],
  "john:8:11": ["Neither do I condemn you. Go, and from now on sin no more."],
  "john:8:19": ["You know neither me nor my Father. If you had known me, you would also have known my Father."],
  "john:8:25": ["Even if I have begun to speak with you,"],
  "john:8:39": ["If you were children of Avraham, you would be doing the works of Avraham."],
  "john:8:41": ["But you do the works of your father."],
  "john:11:39": ["Take away this stone."],
  "john:12:28": ["Father, glorify your name."],
  "john:13:8": ["If I do not wash you, you have no part with me."],
  "john:13:36": ["Where I go, you are not able now to come after me; but at the last you will come."],
  "john:18:4": ["Whom do you seek?"],
  "john:18:5": ["I am."],
  "john:18:6": ["I am"],
  "john:18:7": ["Whom do you seek?"],
  "john:20:15": ["Woman, why are you weeping, and whom are you seeking?"],
  "john:20:16": ["Maryam!"],
  "john:21:15": ["Shimon son of Yonah, do you love me more than these?", "Tend my lambs for me."],
  "john:21:16": ["Shimon son of Yonah, do you love me?", "Tend my sheep for me."],
  "john:21:17": ["Shimon son of Yonah, do you love me?", "Tend my ewes for me."],
  "acts:1:4": ["which you have heard from me."],
  "acts:9:4": ["Shaul, Shaul, why are you persecuting me? It is hard for you to kick against the goads."],
  "acts:9:5": ["I am Y'shua the Natsraya, whom you are persecuting."],
  "acts:9:10": ["Chananya."],
  "acts:11:16": ["Yochanan immersed with water, but you will be immersed with the Ruach haKodesh."],
  "acts:20:35": ["it is more blessed for the one who gives than for the one who receives."],
  "acts:22:7": ["Sha'ul, Sha'ul, why are you persecuting me?"],
  "acts:22:8": ["I am Y'shua the Natsraya, whom you are persecuting."],
  "acts:22:10": ["Rise, go to Darmasuq, and there it will be told you about everything that is commanded you to do."],
  "acts:26:14": ["Shaul, Shaul, why are you persecuting me? It is hard for you to kick against the goads."],
  "acts:26:15": ["I am Y'shua the Natsraya, whom you are persecuting."],
  "revelation:22:20": ["Yes, I come quickly."],
  // Narrator in the middle, or another voice after his.
  "matthew:9:6": [
    "But so that you may know that the Son of man has authority on earth to forgive sins,",
    "Get up, take up your bed, and go to your house.",
  ],
  "matthew:15:34": ["How many loaves do you have?"],
  "matthew:17:25": [
    "How does it appear to you, Shimon? The kings of the earth, from whom do they take tribute and head-money? from their children, or from foreigners?",
  ],
  "matthew:19:18": [
    "You shall not kill; and you shall not commit adultery; and you shall not steal; and you shall not bear false testimony;",
  ],
  "matthew:20:22": [
    "You do not know what you are asking. Are you able to drink the cup that I am about to drink, or be immersed with the immersion that I am immersed with?",
  ],
  "mark:2:10": ["But that you may know that the Son of man has authority on earth to forgive sins,"],
  "mark:6:37": ["You give them to eat."],
  "mark:8:20": ["And when the seven to four thousand, how many baskets full of the fragments did you take up?"],
  "mark:10:51": ["What do you want me to do for you?"],
  "luke:5:24": [
    "But that you may know that the Son of man has authority on earth to forgive sins,",
    "I say to you, Get up, take up your couch, and go to your house.",
  ],
  "luke:8:25": ["Where is your faith?"],
  "luke:8:45": ["Who touched me?"],
  "luke:9:13": ["You give them to eat."],
  "luke:9:20": ["But who do you say that I am?"],
  "luke:9:59": ["Come after me."],
  "luke:10:37": ["Go, you also do likewise."],
  "john:21:5": ["Lads, do you have anything to eat?"],
};

/**
 * Syriac of a mixed verse, in the same order as the English clauses.
 * A phrase is the printed Syriac, not a gloss. which skips earlier copies of the same word.
 */
const SY_SAY: Record<string, string[]> = {
  "matthew:13:51": ["ܐܣܬܟܠܬܘܢ ܟܠܗܝܢ ܗܠܝܢ"],
  "matthew:15:34": ["ܟܡܐ ܠܚܡܝܢ ܐܝܬ ܠܟܘܢ"],
  "matthew:17:25": ["ܡܢܐ ܡܬܚܙܐ ܠܟ ܫܡܥܘܢ ܡܠܟܝܗ ܕܐܪܥܐ ܡܢ ܡܢ ܢܣܒܝܢ ܡܟܣܐ ܘܟܣܦ ܪܫܐ ܡܢ ܒܢܝܗܘܢ ܐܘ ܡܢ ܢܘܟܪܝܐ"],
  "matthew:19:18": ["ܕܠܐ ܬܩܛܘܠ ܘܠܐ ܬܓܘܪ ܘܠܐ ܬܓܢܘܒ ܘܠܐ ܬܣܗܕ ܣܗܕܘܬ ܫܘܩܪܐ"],
  "matthew:20:21": ["ܡܢܐ ܨܒܝܐ ܐܢܬܝ"],
  "matthew:20:22": ["ܠܐ ܝܕܥܝܢ ܐܢܬܘܢ ܡܢܐ ܫܐܠܝܢ ܐܢܬܘܢ ܡܫܟܚܝܢ ܐܢܬܘܢ ܠܡܫܬܐ ܟܣܐ ܕܐܢܐ ܥܬܝܕ ܠܡܫܬܐ ܐܘ ܡܥܡܘܕܝܬܐ ܕܐܢܐ ܥܡܕ ܐܢܐ ܬܥܡܕܘܢ"],
  "matthew:21:27": ["ܐܦ ܠܐ ܐܢܐ ܐܡܪ ܐܢܐ ܠܟܘܢ ܒܐܝܢܐ ܫܘܠܛܢܐ ܗܠܝܢ ܥܒܕ ܐܢܐ"],
  "matthew:21:31": ["ܡܢܘ ܡܢ ܗܠܝܢ ܬܪܝܗܘܢ ܥܒܕ ܨܒܝܢܐ ܕܐܒܘܗܝ", "ܐܡܝܢ ܐܡܪ ܐܢܐ ܠܟܘܢ ܕܡܟܣܐ ܘܙܢܝܬܐ ܩܕܡܝܢ ܠܟܘܢ ܠܡܠܟܘܬܐ ܕܐܠܗܐ"],
  "matthew:22:42": ["ܡܢܐ ܐܡܪܝܢ ܐܢܬܘܢ ܥܠ ܡܫܝܚܐ ܒܪ ܡܢܘ"],
  "matthew:26:25": ["ܐܢܬ ܐܡܪܬ"],
  "matthew:27:11": ["ܐܢܬ ܐܡܪܬ"],
  "matthew:9:6": ["ܕܬܕܥܘܢ ܕܝܢ ܕܫܘܠܛܢܐ ܐܝܬ ܠܒܪܗ ܕܐܢܫܐ ܒܐܪܥܐ ܠܡܫܒܩ ܚܛܗܐ", "ܩܘܡ ܫܩܘܠ ܥܪܣܟ ܘܙܠ ܠܒܝܬܟ"],
  "mark:2:10": ["ܕܬܕܥܘܢ ܕܝܢ ܕܫܠܝܛ ܗܘ ܒܪܗ ܕܐܢܫܐ ܒܐܪܥܐ ܠܡܫܒܩ ܚܛܗܐ"],
  "mark:6:37": ["ܗܒܘ ܠܗܘܢ ܐܢܬܘܢ ܠܡܠܥܣ"],
  "mark:8:20": ["ܘܟܕ ܫܒܥܐ ܠܐܪܒܥܐ ܐܠܦܝܢ ܟܡܐ ܐܣܦܪܝܕܝܢ ܕܩܨܝܐ ܟܕ ܡܠܝܢ ܫܩܠܬܘܢ"],
  "mark:8:27": ["ܡܢܘ ܐܡܪܝܢ ܥܠܝ ܐܢܫܐ ܕܐܝܬܝ"],
  "mark:8:29": ["ܐܢܬܘܢ ܕܝܢ ܡܢܘ ܐܡܪܝܢ ܐܢܬܘܢ ܥܠܝ ܕܐܝܬܝ"],
  "mark:10:51": ["ܡܢܐ ܨܒܐ ܐܢܬ ܐܥܒܕ ܠܟ"],
  "mark:12:34": ["ܠܐ ܗܘܝܬ ܪܚܝܩ ܡܢ ܡܠܟܘܬܐ ܕܐܠܗܐ"],
  "mark:15:2": ["ܐܢܬ ܐܡܪܬ"],
  "luke:5:24": ["ܕܬܕܥܘܢ ܕܝܢ ܕܫܠܝܛ ܗܘ ܒܪܗ ܕܐܢܫܐ ܒܐܪܥܐ ܕܢܫܒܘܩ ܚܛܗܐ", "ܠܟ ܐܡܪ ܐܢܐ ܩܘܡ ܫܩܘܠ ܥܪܣܟ ܘܙܠ ܠܒܝܬܟ"],
  "luke:7:40": ["ܫܡܥܘܢ ܡܕܡ ܐܝܬ ܠܝ ܕܐܡܪ ܠܟ"],
  "luke:7:43": ["ܬܪܝܨܐܝܬ ܕܢܬ"],
  "luke:8:25": ["ܐܝܟܐ ܗܝ ܗܝܡܢܘܬܟܘܢ"],
  "luke:8:45": ["ܡܢܘ ܩܪܒ ܠܝ"],
  "luke:9:13": ["ܗܒܘ ܠܗܘܢ ܐܢܬܘܢ ܠܡܐܟܠ"],
  "luke:9:20": ["ܐܢܬܘܢ ܕܝܢ ܡܢܘ ܐܡܪܝܢ ܐܢܬܘܢ ܕܐܝܬܝ"],
  "luke:9:59": ["ܬܐ ܒܬܪܝ"],
  "luke:10:37": ["ܙܠ ܐܦ ܐܢܬ ܗܟܢܐ ܗܘܝܬ ܥܒܕ"],
  "luke:17:37": ["ܐܝܟܐ ܕܦܓܪܐ ܬܡܢ ܢܬܟܢܫܘܢ ܢܫܪܐ"],
  "luke:22:35": ["ܟܕ ܫܕܪܬܟܘܢ ܕܠܐ ܟܝܣܐ ܘܕܠܐ ܬܪܡܠܐ ܘܡܣܢܐ ܠܡܐ ܚܣܪ ܠܟܘܢ ܡܕܡ"],
  "luke:22:38": ["ܣܦܩܝܢ"],
  "luke:23:3": ["ܐܢܬ ܐܡܪܬ"],
  "luke:24:19": ["ܡܢܐ"],
  "john:1:38": ["ܡܢܐ ܒܥܝܢ ܐܢܬܘܢ"],
  "john:4:17": ["ܫܦܝܪ ܐܡܪܬܝ ܕܠܝܬ ܠܝ ܒܥܠܐ"],
  "john:4:53": ["ܕܒܪܟ ܚܝܐ"],
  "john:7:20": ["ܡܢܐ ܒܥܝܢ ܐܢܬܘܢ ܠܡܩܛܠܢܝ"],
  "john:8:11": ["ܐܦܠܐ ܐܢܐ ܡܚܝܒ ܐܢܐ ܠܟܝ ܙܠܝ ܘܡܢ ܗܫܐ ܬܘܒ ܠܐ ܬܚܛܝܢ"],
  "john:8:19": ["ܘܠܐ ܠܝ ܝܕܥܝܢ ܐܢܬܘܢ ܘܠܐ ܠܐܒܝ ܐܠܘ ܠܝ ܝܕܥܝܢ ܗܘܝܬܘܢ ܐܦ ܠܐܒܝ ܝܕܥܝܢ ܗܘܝܬܘܢ"],
  "john:8:25": ["ܐܦܢ ܕܫܪܝܬ ܕܐܡܠܠ ܥܡܟܘܢ"],
  "john:8:39": ["ܐܠܘ ܒܢܘܗܝ ܗܘܝܬܘܢ ܕܐܒܪܗܡ ܥܒܕܘܗܝ ܕܐܒܪܗܡ ܥܒܕܝܢ ܗܘܝܬܘܢ"],
  "john:8:41": ["ܐܢܬܘܢ ܕܝܢ ܥܒܕܝܢ ܐܢܬܘܢ ܥܒܕܐ ܕܐܒܘܟܘܢ"],
  "john:11:39": ["ܫܩܘܠܘ ܟܐܦܐ ܗܕܐ"],
  "john:12:28": ["ܐܒܐ ܫܒܚ ܫܡܟ"],
  "john:13:8": ["ܐܢ ܠܐ ܡܫܝܓ ܐܢܐ ܠܟ ܠܝܬ ܠܟ ܥܡܝ ܡܢܬܐ"],
  "john:13:36": ["ܠܐܝܟܐ ܕܐܙܠ ܐܢܐ ܠܐ ܡܫܟܚ ܐܢܬ ܗܫܐ ܕܬܐܬܐ ܒܬܪܝ ܠܚܪܬܐ ܕܝܢ ܬܐܬܐ"],
  "john:18:4": ["ܠܡܢ ܒܥܝܢ ܐܢܬܘܢ"],
  "john:18:5": ["ܐܢܐ ܐܢܐ"],
  "john:18:6": ["ܕܐܢܐ ܐܢܐ"],
  "john:18:7": ["ܠܡܢ ܒܥܝܢ ܐܢܬܘܢ"],
  "john:20:15": ["ܐܢܬܬܐ ܡܢܐ ܒܟܝܐ ܐܢܬܝ ܘܠܡܢ ܒܥܝܐ ܐܢܬܝ"],
  "john:20:16": ["ܡܪܝܡ"],
  "john:21:5": ["ܛܠܝܐ ܠܡܐ ܐܝܬ ܠܟܘܢ ܡܕܡ ܠܡܠܥܣ"],
  "john:21:15": ["ܫܡܥܘܢ ܒܪ ܝܘܢܐ ܪܚܡ ܐܢܬ ܠܝ ܝܬܝܪ ܡܢ ܗܠܝܢ", "ܪܥܝ ܠܝ ܐܡܪܝ"],
  "john:21:16": ["ܫܡܥܘܢ ܒܪ ܝܘܢܐ ܪܚܡ ܐܢܬ ܠܝ", "ܪܥܝ ܠܝ ܥܪܒܝ"],
  "john:21:17": ["ܫܡܥܘܢ ܒܪ ܝܘܢܐ ܪܚܡ ܐܢܬ ܠܝ", "ܪܥܝ ܠܝ ܢܩܘܬܝ"],
  "acts:1:4": ["ܗܘ ܕܫܡܥܬܘܢ ܡܢܝ"],
  "acts:9:4": ["ܫܐܘܠ ܫܐܘܠ ܡܢܐ ܪܕܦ ܐܢܬ ܠܝ ܩܫܐ ܗܘ ܠܟ ܠܡܒܥܛܘ ܠܥܘܩܣܐ"],
  "acts:9:5": ["ܐܢܐ ܐܢܐ ܝܫܘܥ ܢܨܪܝܐ ܗܘ ܕܐܢܬ ܪܕܦ ܐܢܬ"],
  "acts:9:10": ["ܚܢܢܝܐ"],
  "acts:11:16": ["ܕܝܘܚܢܢ ܐܥܡܕ ܒܡܝܐ ܐܢܬܘܢ ܕܝܢ ܬܥܡܕܘܢ ܒܪܘܚܐ ܕܩܘܕܫܐ"],
  "acts:20:35": ["ܛܘܒܘܗܝ ܠܐܝܢܐ ܕܝܗܒ ܝܬܝܪ ܡܢ ܐܝܢܐ ܕܢܣܒ"],
  "acts:22:7": ["ܫܐܘܠ ܫܐܘܠ ܡܢܐ ܪܕܦ ܐܢܬ ܠܝ"],
  "acts:22:8": ["ܐܢܐ ܗܘ ܝܫܘܥ ܢܨܪܝܐ ܕܐܢܬ ܪܕܦ ܐܢܬ"],
  "acts:22:10": ["ܩܘܡ ܙܠ ܠܕܪܡܣܘܩ ܘܬܡܢ ܢܬܡܠܠ ܥܡܟ ܥܠ ܟܠ ܡܕܡ ܕܡܬܦܩܕ ܠܟ ܕܬܥܒܕ"],
  "acts:26:14": ["ܫܐܘܠ ܫܐܘܠ ܡܢܐ ܪܕܦ ܐܢܬ ܠܝ ܩܫܐ ܗܘ ܠܟ ܠܡܒܥܛܘ ܠܥܘܩܣܐ"],
  "acts:26:15": ["ܐܢܐ ܗܘ ܝܫܘܥ ܢܨܪܝܐ ܕܐܢܬ ܪܕܦ ܐܢܬ"],
  "revelation:22:20": ["ܐܝܢ ܐܬܐ ܐܢܐ ܒܥܓܠ"],
};

/** Which copy of a repeated Syriac word is his. acts 9:10 names Chananya, then calls him. */
const SY_WHICH: Record<string, number[]> = {
  "acts:9:10": [1],
};

function placeKey(book: string, chapter: number, verse: number) {
  return `${book}:${chapter}:${verse}`;
}

function inRanges(book: string, chapter: number, verse: number) {
  const ranges = RANGES[book];
  if (!ranges) return false;
  return ranges.some(([ch, from, to]) => ch === chapter && verse >= from && verse <= to);
}

export type Speech = { kind: "whole" } | { kind: "part"; say: string[] };

/** His voice in this verse: the whole verse, only some clauses, or none. */
export function speechOf(book: string, chapter: number, verse: number): Speech | null {
  const key = placeKey(book, chapter, verse);
  const say = CLAUSES[key];
  if (say) return { kind: "part", say };
  if (NOT_HIS.has(key)) return null;
  if (inRanges(book, chapter, verse)) return { kind: "whole" };
  return null;
}

export function isJesus(book: string, chapter: number, verse: number) {
  return speechOf(book, chapter, verse) !== null;
}

/** Paint only his clauses. Phrases must occur in order. which picks a later copy of the same word. */
export function speechSpans(text: string, say: string[], which?: number[]) {
  const spans: { text: string; red: boolean }[] = [];
  let cursor = 0;
  for (let i = 0; i < say.length; i++) {
    const phrase = say[i];
    const skip = which?.[i] ?? 0;
    let at = -1;
    let from = cursor;
    for (let n = 0; n <= skip; n++) {
      at = text.indexOf(phrase, from);
      if (at < 0) return null;
      from = at + 1;
    }
    if (at > cursor) spans.push({ text: text.slice(cursor, at), red: false });
    spans.push({ text: phrase, red: true });
    cursor = at + phrase.length;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), red: false });
  return spans.filter((span) => span.text.length > 0);
}

export function speechRanges(text: string, say: string[], which?: number[]): [number, number][] | null {
  const spans = speechSpans(text, say, which);
  if (!spans) return null;
  const ranges: [number, number][] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.red) ranges.push([cursor, cursor + span.text.length]);
    cursor += span.text.length;
  }
  return ranges;
}

export function rangeHits(ranges: [number, number][] | null | undefined, start: number, end: number) {
  return !!ranges?.some(([from, to]) => start < to && from < end);
}

/**
 * The first "he said" inside a parable, or inside his own quotation, is not the evangelist's lead-in.
 * Those verses stay one color rather than blacking words he is speaking.
 */
const DENY_LEAD = new Set([
  "matthew:13:28", "matthew:13:29", "matthew:19:5",
  "matthew:20:4", "matthew:20:6", "matthew:20:13",
  "matthew:21:29", "matthew:22:4", "matthew:22:8", "matthew:22:12",
  "matthew:25:12", "matthew:25:20", "matthew:25:22", "matthew:25:24",
  "mark:12:6", "mark:14:14",
  "luke:5:39", "luke:10:35", "luke:12:17", "luke:12:18", "luke:13:7",
  "luke:15:17", "luke:15:27", "luke:15:29",
  "luke:16:5", "luke:16:6", "luke:16:7", "luke:16:27", "luke:16:30",
  "luke:17:4", "luke:19:13", "luke:19:17", "luke:19:22", "luke:19:24", "luke:19:26",
  "luke:20:37", "luke:22:11",
]);

const LEAD_RE = /^(.*?)\b((?:Y'shua|he|He)\b[^.]{0,160}?\b(?:answered(?: and)? )?(?:said|says))\b(\s+to\s+[^,:.]{1,70})?\s*[,:—]\s+/;

function narrativeTail(sentence: string) {
  if (/\b(I|me|my|we|our)\b/.test(sentence)) return false;
  if (/Y'shua said/.test(sentence)) return false;
  if (/^This he said\b/.test(sentence)) return true;
  return /^(?:And|But|Then)\s+(?:they|she|his|the|Y'shua|all|those|when|it|immediately)\b/.test(sentence)
    || /^(?:And|But|Then)\s+he\s+(?:said|says|came|went|rose|departed|answered|turned|began|did|was|took|left|entered|called|sent|found|stood|rebuked|stretched|touched|heard|saw|looked|knew|commanded)\b/.test(sentence);
}

function stripTrail(say: string) {
  let text = say;
  for (let guard = 0; guard < 6; guard++) {
    const match = text.match(/^([\s\S]+[.!?])\s+([^.!?]+[.!?]?)$/);
    if (!match || !narrativeTail(match[2])) break;
    text = match[1];
  }
  return text;
}

/** Evangelist's lead-in on a whole verse, removed. The return is his speech, still an exact substring. */
function leadSay(book: string, chapter: number, verse: number, english: string) {
  const key = placeKey(book, chapter, verse);
  if (DENY_LEAD.has(key)) return null;
  if (speechOf(book, chapter, verse)?.kind !== "whole") return null;
  const match = english.match(LEAD_RE);
  if (!match) return null;
  const prefix = match[1] + match[2] + (match[3] || "");
  if (/[.?!]/.test(prefix) || prefix.length > 200) return null;
  if (/was said|it was said|you have heard|who says|said that/i.test(prefix)) return null;
  if (/[:;]/.test(prefix)) return null;
  const rest = english.slice(match[0].length);
  if (!/^[A-Z‹“"']/.test(rest) || rest.length < 2) return null;
  const say = stripTrail(rest);
  return say.length > 1 ? say : null;
}

/** English clauses to paint red. Null means the whole verse is one color. */
export function englishPhrases(book: string, chapter: number, verse: number, english: string) {
  const speech = speechOf(book, chapter, verse);
  if (!speech) return null;
  if (speech.kind === "part") return speech.say;
  const say = leadSay(book, chapter, verse, english);
  return say ? [say] : null;
}

const SY_OBJECT = new Set(["ܠܗ", "ܠܗܘܢ", "ܠܟ", "ܠܟܘܢ", "ܠܗܝ", "ܠܗ̇", "ܝܫܘܥ", "ܠܗܘ"]);

function bareSyriac(word: string) {
  return word.replace(/[\u0700-\u070d.,:;]/g, "");
}

/** After an English lead-in, drop the Syriac ܐܡܪ clause when it stands among the first words. */
function syriacLead(syriac: string) {
  const parts = syriac.split(/(\s+)/);
  let words = 0;
  let verb = -1;
  for (let i = 0; i < parts.length && words < 12; i++) {
    if (!parts[i].trim()) continue;
    const word = bareSyriac(parts[i]);
    if (word === "ܐܡܪ" || word === "ܘܐܡܪ" || word === "ܕܐܡܪ") verb = i;
    words++;
    if (verb >= 0) break;
  }
  if (verb < 0) return null;
  let end = verb;
  let taken = 0;
  for (let i = verb + 1; i < parts.length && taken < 3; i++) {
    if (!parts[i].trim()) {
      end = i;
      continue;
    }
    if (!SY_OBJECT.has(bareSyriac(parts[i]))) break;
    end = i;
    taken++;
  }
  const say = syriac.slice(parts.slice(0, end + 1).join("").length).trimStart();
  if (say.split(/\s+/).length < 2) return null;
  return say;
}

/** Syriac clauses to paint red. A whole verse is split only when the English lead-in was cut too. */
export function syriacPhrases(book: string, chapter: number, verse: number, syriac: string, english = "") {
  if (!syriac) return null;
  const key = placeKey(book, chapter, verse);
  const fixed = SY_SAY[key];
  if (fixed) return { say: fixed, which: SY_WHICH[key] };
  if (speechOf(book, chapter, verse)?.kind !== "whole") return null;
  if (!leadSay(book, chapter, verse, english)) return null;
  const say = syriacLead(syriac);
  return say ? { say: [say] } : null;
}

const FOREIGN_VERB: Record<string, RegExp> = {
  es: /\b(?:dijo|dice|respondió|responde|diciendo|dijeron)\b/gi,
  de: /\b(?:sagte|sagt|sprach|spricht|antwortete|sagend)\b/gi,
  fr: /\b(?:dit|disait|répondit|répond|disant)\b/gi,
  ru: /(?:сказал|говорит|отвечал|ответил|говоря|сказав|говорил)/gi,
};

/** Index where his speech starts, after a speech verb and a colon. Null if the line has no such lead-in. */
export function foreignAt(text: string, lang: string) {
  const verb = FOREIGN_VERB[lang];
  if (!verb || !text) return null;
  verb.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = verb.exec(text))) {
    if (match.index > 220) break;
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 60);
    const colon = after.search(/[:：]/);
    if (colon < 0) continue;
    let at = match.index + match[0].length + colon + 1;
    while (text[at] === " ") at++;
    if (text.length - at < 2) return null;
    return at;
  }
  return null;
}

export function foreignSpeech(text: string, lang: string) {
  const at = foreignAt(text, lang);
  return at == null ? null : text.slice(at);
}

/** The words themselves, for the sayings page and its reading. Lead-ins are not part of the saying. */
export function sayingText(book: string, chapter: number, verse: number, english: string) {
  const speech = speechOf(book, chapter, verse);
  if (!speech) return "";
  const phrases = englishPhrases(book, chapter, verse, english);
  if (phrases) return phrases.join(" ");
  return english;
}

export const GOSPELS = ["matthew", "mark", "luke", "john"] as const;

/** Every book that records words of Y'shua in red. */
export const RED_BOOKS = ["matthew", "mark", "luke", "john", "acts", "revelation"] as const;

export type RedBook = (typeof RED_BOOKS)[number];

export function nextRedBook(book: string): RedBook | null {
  const index = RED_BOOKS.indexOf(book as RedBook);
  if (index < 0 || index >= RED_BOOKS.length - 1) return null;
  return RED_BOOKS[index + 1];
}
