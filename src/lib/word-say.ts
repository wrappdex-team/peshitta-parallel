import type { LangId } from "@/lib/languages";

type Say = Partial<Record<LangId, string>>;

function row(
  en: string,
  el: string,
  he: string,
  ar: string,
  fr: string,
  ru: string,
  es: string,
  zh: string,
  de: string,
  ja: string,
  aii: string,
): Say {
  return { en, el, he, ar, fr, ru, es, zh, de, ja, aii };
}

/** Learner equivalents for a gloss, so a form can be heard in the tongues open on the page. */
const SAY: Record<string, Say> = {
  and: row("and", "και", "וְ", "و", "et", "и", "y", "和", "und", "そして", "ܘ"),
  of: row("of", "του", "שֶׁל", "من", "de", "из", "de", "的", "von", "の", "ܕ"),
  to: row("to", "σε", "אֶל", "إلى", "à", "к", "a", "向", "zu", "へ", "ܠ"),
  in: row("in", "σε", "בְּ", "في", "dans", "в", "en", "在", "in", "に", "ܒ"),
  from: row("from", "από", "מִן", "من", "de", "от", "de", "从", "von", "から", "ܡܢ"),
  upon: row("upon", "πάνω", "עַל", "على", "sur", "на", "sobre", "在上", "auf", "の上に", "ܥܠ"),
  with: row("with", "με", "עִם", "مع", "avec", "с", "con", "与", "mit", "と", "ܥܡ"),
  that: row("that", "ότι", "שֶׁ", "أن", "que", "что", "que", "那", "dass", "ということ", "ܕ"),
  but: row("but", "αλλά", "אֲבָל", "لكن", "mais", "но", "pero", "但", "aber", "しかし", "ܐܠܐ"),
  now: row("now", "τώρα", "עַתָּה", "الآن", "maintenant", "теперь", "ahora", "如今", "nun", "今", "ܗܫܐ"),
  not: row("not", "δεν", "לֹא", "لا", "ne pas", "не", "no", "不", "nicht", "ない", "ܠܐ"),
  also: row("also", "επίσης", "גַּם", "أيضا", "aussi", "также", "también", "也", "auch", "も", "ܐܦ"),
  for: row("for", "γιατί", "כִּי", "لأن", "car", "ибо", "porque", "因为", "denn", "なぜなら", "ܓܝܪ"),
  when: row("when", "όταν", "כַּאֲשֶׁר", "عندما", "quand", "когда", "cuando", "当", "als", "とき", "ܟܕ"),
  as: row("as", "ως", "כְּ", "كـ", "comme", "как", "como", "如", "wie", "ように", "ܐܝܟ"),
  like: row("like", "σαν", "כְּמוֹ", "مثل", "comme", "как", "como", "像", "wie", "のように", "ܐܝܟ"),
  if: row("if", "αν", "אִם", "إن", "si", "если", "si", "如果", "wenn", "もし", "ܐܢ"),
  this: row("this", "αυτό", "זֶה", "هذا", "ceci", "это", "esto", "这", "dies", "これ", "ܗܢܐ"),
  who: row("who", "ποιος", "מִי", "من", "qui", "кто", "quién", "谁", "wer", "だれ", "ܡܢ"),
  all: row("all", "όλα", "כֹּל", "كل", "tout", "всё", "todo", "所有", "alles", "すべて", "ܟܠ"),
  every: row("every", "κάθε", "כָּל", "كل", "chaque", "каждый", "cada", "每", "jeder", "すべての", "ܟܠ"),
  one: row("one", "ένα", "אֶחָד", "واحد", "un", "один", "uno", "一", "eins", "一つ", "ܚܕ"),
  he: row("he", "αυτός", "הוּא", "هو", "il", "он", "él", "他", "er", "彼", "ܗܘ"),
  she: row("she", "αυτή", "הִיא", "هي", "elle", "она", "ella", "她", "sie", "彼女", "ܗܝ"),
  they: row("they", "αυτοί", "הֵם", "هم", "ils", "они", "ellos", "他们", "sie", "彼ら", "ܗܢܘܢ"),
  i: row("I", "εγώ", "אֲנִי", "أنا", "je", "я", "yo", "我", "ich", "私", "ܐܢܐ"),
  you: row("you", "εσύ", "אַתָּה", "أنت", "tu", "ты", "tú", "你", "du", "あなた", "ܐܢܬ"),
  we: row("we", "εμείς", "אֲנַחְנוּ", "نحن", "nous", "мы", "nosotros", "我们", "wir", "私たち", "ܚܢܢ"),
  his: row("his", "του", "שֶׁלּוֹ", "ـه", "son", "его", "su", "他的", "sein", "彼の", "ܗ"),
  her: row("her", "της", "שֶׁלָּהּ", "ـها", "sa", "её", "su", "她的", "ihr", "彼女の", "ܗ"),
  their: row("their", "τους", "שֶׁלָּהֶם", "ـهم", "leur", "их", "su", "他们的", "ihr", "彼らの", "ܗܘܢ"),
  my: row("my", "μου", "שֶׁלִּי", "ـي", "mon", "мой", "mi", "我的", "mein", "私の", "ܝ"),
  your: row("your", "σου", "שֶׁלְּךָ", "ـك", "ton", "твой", "tu", "你的", "dein", "あなたの", "ܟ"),
  our: row("our", "μας", "שֶׁלָּנוּ", "ـنا", "notre", "наш", "nuestro", "我们的", "unser", "私たちの", "ܢ"),
  said: row("said", "είπε", "אָמַר", "قال", "dit", "сказал", "dijo", "说", "sagte", "言った", "ܐܡܪ"),
  say: row("say", "πες", "אֱמֹר", "قل", "dis", "скажи", "di", "说", "sage", "言え", "ܐܡܪ"),
  was: row("was", "ήταν", "הָיָה", "كان", "était", "был", "era", "是", "war", "であった", "ܗܘܐ"),
  were: row("were", "ήταν", "הָיוּ", "كانوا", "étaient", "были", "eran", "是", "waren", "であった", "ܗܘܘ"),
  is: row("is", "είναι", "הוּא", "هو", "est", "есть", "es", "是", "ist", "である", "ܐܝܬ"),
  came: row("came", "ήλθε", "בָּא", "جاء", "vint", "пришёл", "vino", "来", "kam", "来た", "ܐܬܐ"),
  come: row("come", "έλα", "בּוֹא", "تعال", "viens", "приди", "ven", "来", "komm", "来い", "ܐܬܐ"),
  went: row("went", "πήγε", "הָלַךְ", "ذهب", "alla", "пошёл", "fue", "去", "ging", "行った", "ܐܙܠ"),
  go: row("go", "πήγαινε", "לֵךְ", "اذهب", "va", "иди", "ve", "去", "geh", "行け", "ܐܙܠ"),
  gave: row("gave", "έδωσε", "נָתַן", "أعطى", "donna", "дал", "dio", "给", "gab", "与えた", "ܝܗܒ"),
  give: row("give", "δώσε", "תֵּן", "أعطِ", "donne", "дай", "da", "给", "gib", "与えよ", "ܝܗܒ"),
  saw: row("saw", "είδε", "רָאָה", "رأى", "vit", "увидел", "vio", "看见", "sah", "見た", "ܚܙܐ"),
  see: row("see", "δες", "רְאֵה", "انظر", "vois", "смотри", "ve", "看", "sieh", "見よ", "ܚܙܐ"),
  heard: row("heard", "άκουσε", "שָׁמַע", "سمع", "entendit", "услышал", "oyó", "听见", "hörte", "聞いた", "ܫܡܥ"),
  hear: row("hear", "άκου", "שְׁמַע", "اسمع", "écoute", "слушай", "oye", "听", "höre", "聞け", "ܫܡܥ"),
  knew: row("knew", "γνώριζε", "יָדַע", "عرف", "savait", "знал", "sabía", "知道", "wusste", "知っていた", "ܝܕܥ"),
  know: row("know", "γνώριζε", "דַּע", "اعرف", "sache", "знай", "sabe", "知道", "wisse", "知れ", "ܝܕܥ"),
  wrote: row("wrote", "έγραψε", "כָּתַב", "كتب", "écrivit", "написал", "escribió", "写", "schrieb", "書いた", "ܟܬܒ"),
  write: row("write", "γράψε", "כְּתֹב", "اكتب", "écris", "пиши", "escribe", "写", "schreib", "書け", "ܟܬܒ"),
  lived: row("lived", "έζησε", "חַי", "عاش", "vécut", "жил", "vivió", "活", "lebte", "生きた", "ܚܝܐ"),
  live: row("live", "ζήσε", "חֲיֵה", "عش", "vis", "живи", "vive", "活", "lebe", "生きよ", "ܚܝܐ"),
  loved: row("loved", "αγάπησε", "אָהַב", "أحب", "aima", "любил", "amó", "爱", "liebte", "愛した", "ܐܚܒ"),
  love: row("love", "αγάπα", "אֱהֹב", "أحب", "aime", "люби", "ama", "爱", "liebe", "愛せよ", "ܐܚܒ"),
  believed: row("believed", "πίστεψε", "הֶאֱמִין", "آمن", "crut", "поверил", "creyó", "信", "glaubte", "信じた", "ܗܝܡܢ"),
  believe: row("believe", "πίστεψε", "הַאֲמֵן", "آمن", "crois", "верь", "cree", "信", "glaube", "信じよ", "ܗܝܡܢ"),
  called: row("called", "κάλεσε", "קָרָא", "دعا", "appela", "назвал", "llamó", "叫", "rief", "呼んだ", "ܩܪܐ"),
  took: row("took", "πήρε", "לָקַח", "أخذ", "prit", "взял", "tomó", "拿", "nahm", "取った", "ܢܣܒ"),
  sent: row("sent", "έστειλε", "שָׁלַח", "أرسل", "envoya", "послал", "envió", "差", "sandte", "遣わした", "ܫܕܪ"),
  answered: row("answered", "απάντησε", "עָנָה", "أجاب", "répondit", "ответил", "respondió", "回答", "antwortete", "答えた", "ܥܢܐ"),
  elohim: row("Elohim", "Ελοχίμ", "אֱלֹהִים", "الله", "Dieu", "Бог", "Dios", "上帝", "Gott", "神", "ܐܠܗܐ"),
  god: row("God", "Ελοχίμ", "אֱלֹהִים", "الله", "Dieu", "Бог", "Dios", "上帝", "Gott", "神", "ܐܠܗܐ"),
  "y'shua": row("Y'shua", "Ιεσούα", "יֵשׁוּעַ", "يشوع", "Jésus", "Иисус", "Jesús", "耶稣", "Jesus", "イエス", "ܝܫܘܥ"),
  yeshua: row("Y'shua", "Ιεσούα", "יֵשׁוּעַ", "يشوع", "Jésus", "Иисус", "Jesús", "耶稣", "Jesus", "イエス", "ܝܫܘܥ"),
  mashiyach: row("Mashiyach", "Μασιάχ", "מָשִׁיחַ", "ماشيح", "Messie", "Мессия", "Mesías", "弥赛亚", "Messias", "メシア", "ܡܫܝܚܐ"),
  messiah: row("Mashiyach", "Μασιάχ", "מָשִׁיחַ", "ماشيح", "Messie", "Мессия", "Mesías", "弥赛亚", "Messias", "メシア", "ܡܫܝܚܐ"),
  maryam: row("Maryam", "Μαριάμ", "מִרְיָם", "مريم", "Marie", "Мария", "María", "马利亚", "Maria", "マリア", "ܡܪܝܡ"),
  keefa: row("Keefa", "Κεφά", "כֵּיפָא", "كيفا", "Keefa", "Кифа", "Cefas", "矶法", "Kephas", "ケパ", "ܟܐܦܐ"),
  word: row("word", "λόγος", "דָּבָר", "كلمة", "parole", "слово", "palabra", "道", "Wort", "言", "ܡܠܬܐ"),
  son: row("son", "γιος", "בֵּן", "ابن", "fils", "сын", "hijo", "儿子", "Sohn", "子", "ܒܪܐ"),
  father: row("father", "πατέρας", "אָב", "أب", "père", "отец", "padre", "父", "Vater", "父", "ܐܒܐ"),
  spirit: row("spirit", "πνεύμα", "רוּחַ", "روح", "esprit", "дух", "espíritu", "灵", "Geist", "霊", "ܪܘܚܐ"),
  man: row("man", "άνθρωπος", "אִישׁ", "رجل", "homme", "человек", "hombre", "人", "Mensch", "人", "ܓܒܪܐ"),
  woman: row("woman", "γυναίκα", "אִשָּׁה", "امرأة", "femme", "женщина", "mujer", "女人", "Frau", "女", "ܐܢܬܬܐ"),
  day: row("day", "ημέρα", "יוֹם", "يوم", "jour", "день", "día", "日", "Tag", "日", "ܝܘܡܐ"),
  house: row("house", "οίκος", "בַּיִת", "بيت", "maison", "дом", "casa", "家", "Haus", "家", "ܒܝܬܐ"),
  king: row("king", "βασιλιάς", "מֶלֶךְ", "ملك", "roi", "царь", "rey", "王", "König", "王", "ܡܠܟܐ"),
  name: row("name", "όνομα", "שֵׁם", "اسم", "nom", "имя", "nombre", "名", "Name", "名", "ܫܡܐ"),
  world: row("world", "κόσμος", "עוֹלָם", "عالم", "monde", "мир", "mundo", "世界", "Welt", "世界", "ܥܠܡܐ"),
  heaven: row("heaven", "ουρανός", "שָׁמַיִם", "سماء", "ciel", "небо", "cielo", "天", "Himmel", "天", "ܫܡܝܐ"),
  heavens: row("heavens", "ουρανοί", "שָׁמַיִם", "سماوات", "cieux", "небеса", "cielos", "诸天", "Himmel", "天", "ܫܡܝܐ"),
  earth: row("earth", "γη", "אֶרֶץ", "أرض", "terre", "земля", "tierra", "地", "Erde", "地", "ܐܪܥܐ"),
  water: row("water", "νερό", "מַיִם", "ماء", "eau", "вода", "agua", "水", "Wasser", "水", "ܡܝܐ"),
  bread: row("bread", "ψωμί", "לֶחֶם", "خبز", "pain", "хлеб", "pan", "饼", "Brot", "パン", "ܠܚܡܐ"),
  hand: row("hand", "χέρι", "יָד", "يد", "main", "рука", "mano", "手", "Hand", "手", "ܐܝܕܐ"),
  heart: row("heart", "καρδιά", "לֵב", "قلب", "cœur", "сердце", "corazón", "心", "Herz", "心", "ܠܒܐ"),
  people: row("people", "λαός", "עַם", "شعب", "peuple", "народ", "pueblo", "民", "Volk", "民", "ܥܡܐ"),
  life: row("life", "ζωή", "חַיִּים", "حياة", "vie", "жизнь", "vida", "生命", "Leben", "命", "ܚܝܐ"),
  death: row("death", "θάνατος", "מָוֶת", "موت", "mort", "смерть", "muerte", "死", "Tod", "死", "ܡܘܬܐ"),
  truth: row("truth", "αλήθεια", "אֱמֶת", "حق", "vérité", "истина", "verdad", "真理", "Wahrheit", "真理", "ܫܪܪܐ"),
  way: row("way", "οδός", "דֶּרֶךְ", "طريق", "chemin", "путь", "camino", "路", "Weg", "道", "ܐܘܪܚܐ"),
  light: row("light", "φως", "אוֹר", "نور", "lumière", "свет", "luz", "光", "Licht", "光", "ܢܘܗܪܐ"),
  darkness: row("darkness", "σκοτάδι", "חֹשֶׁךְ", "ظلمة", "ténèbres", "тьма", "tinieblas", "暗", "Finsternis", "闇", "ܚܫܘܟܐ"),
  peace: row("peace", "ειρήνη", "שָׁלוֹם", "سلام", "paix", "мир", "paz", "平安", "Friede", "平和", "ܫܠܡܐ"),
  glory: row("glory", "δόξα", "כָּבוֹד", "مجد", "gloire", "слава", "gloria", "荣耀", "Ehre", "栄光", "ܫܘܒܚܐ"),
  law: row("law", "νόμος", "תּוֹרָה", "ناموس", "loi", "закон", "ley", "律法", "Gesetz", "律法", "ܢܡܘܣܐ"),
  sin: row("sin", "αμαρτία", "חֵטְא", "خطيئة", "péché", "грех", "pecado", "罪", "Sünde", "罪", "ܚܛܝܬܐ"),
  faith: row("faith", "πίστη", "אֱמוּנָה", "إيمان", "foi", "вера", "fe", "信", "Glaube", "信仰", "ܗܝܡܢܘܬܐ"),
  rock: row("rock", "κεφά", "כֵּיפָא", "كيفا", "keefa", "кифа", "cefa", "矶法", "Kephas", "ケパ", "ܟܐܦܐ"),
  messenger: row("messenger", "άγγελος", "מַלְאָךְ", "ملاك", "messager", "вестник", "mensajero", "使者", "Bote", "使い", "ܡܠܐܟܐ"),
  brother: row("brother", "αδελφός", "אָח", "أخ", "frère", "брат", "hermano", "弟兄", "Bruder", "兄弟", "ܐܚܐ"),
  mother: row("mother", "μητέρα", "אֵם", "أم", "mère", "мать", "madre", "母", "Mutter", "母", "ܐܡܐ"),
  city: row("city", "πόλη", "עִיר", "مدينة", "ville", "город", "ciudad", "城", "Stadt", "町", "ܡܕܝܢܬܐ"),
  fire: row("fire", "φωτιά", "אֵשׁ", "نار", "feu", "огонь", "fuego", "火", "Feuer", "火", "ܢܘܪܐ"),
  voice: row("voice", "φωνή", "קוֹל", "صوت", "voix", "голос", "voz", "声音", "Stimme", "声", "ܩܠܐ"),
  place: row("place", "τόπος", "מָקוֹם", "موضع", "lieu", "место", "lugar", "地方", "Ort", "場所", "ܕܘܟܬܐ"),
  power: row("power", "δύναμη", "כֹּחַ", "قوة", "puissance", "сила", "poder", "能力", "Kraft", "力", "ܚܝܠܐ"),
  kingdom: row("kingdom", "βασιλεία", "מַלְכוּת", "ملكوت", "royaume", "царство", "reino", "国", "Reich", "国", "ܡܠܟܘܬܐ"),
  good: row("good", "καλός", "טוֹב", "حسن", "bon", "добрый", "bueno", "好", "gut", "良い", "ܛܒ"),
  evil: row("evil", "πονηρός", "רַע", "شرير", "mal", "злой", "malo", "恶", "böse", "悪", "ܒܝܫ"),
  holy: row("holy", "άγιος", "קָדוֹשׁ", "قدوس", "saint", "святой", "santo", "圣", "heilig", "聖", "ܩܕܝܫ"),
  great: row("great", "μέγας", "גָּדוֹל", "عظيم", "grand", "великий", "grande", "大", "groß", "大きい", "ܪܒ"),
  many: row("many", "πολλοί", "רַבִּים", "كثير", "beaucoup", "многие", "muchos", "许多", "viele", "多くの", "ܣܓܝ"),
  true: row("true", "αληθινός", "אֱמֶת", "حق", "vrai", "истинный", "verdadero", "真", "wahr", "真", "ܫܪܝܪ"),
  lord: row("lord", "κύριος", "אָדוֹן", "رب", "seigneur", "господь", "señor", "主", "Herr", "主", "ܡܪܝܐ"),
  master: row("master", "κύριος", "אָדוֹן", "رب", "maître", "господин", "señor", "主", "Herr", "主", "ܡܪܝܐ"),
  body: row("body", "σώμα", "גּוּף", "جسد", "corps", "тело", "cuerpo", "身体", "Leib", "体", "ܦܓܪܐ"),
  blood: row("blood", "αίμα", "דָּם", "دم", "sang", "кровь", "sangre", "血", "Blut", "血", "ܕܡܐ"),
  flesh: row("flesh", "σάρκα", "בָּשָׂר", "جسد", "chair", "плоть", "carne", "肉身", "Fleisch", "肉", "ܒܣܪܐ"),
  soul: row("soul", "ψυχή", "נֶפֶשׁ", "نفس", "âme", "душа", "alma", "魂", "Seele", "魂", "ܢܦܫܐ"),
  night: row("night", "νύχτα", "לַיְלָה", "ليل", "nuit", "ночь", "noche", "夜", "Nacht", "夜", "ܠܠܝܐ"),
  sea: row("sea", "θάλασσα", "יָם", "بحر", "mer", "море", "mar", "海", "Meer", "海", "ܝܡܐ"),
  land: row("land", "γη", "אֶרֶץ", "أرض", "terre", "земля", "tierra", "地", "Land", "地", "ܐܪܥܐ"),
  eye: row("eye", "μάτι", "עַיִן", "عين", "œil", "глаз", "ojo", "眼", "Auge", "目", "ܥܝܢܐ"),
  eyes: row("eyes", "μάτια", "עֵינַיִם", "عيون", "yeux", "глаза", "ojos", "眼", "Augen", "目", "ܥܝܢܐ"),
  beginning: row("beginning", "αρχή", "רֵאשִׁית", "بدء", "commencement", "начало", "principio", "起初", "Anfang", "初め", "ܪܫܝܬ"),
  the: row("", "", "", "", "", "", "", "", "", "", ""),
  a: row("", "", "", "", "", "", "", "", "", "", ""),
  an: row("", "", "", "", "", "", "", "", "", "", ""),
};

const SKIP = new Set(["the", "a", "an"]);

export type Cognate = { he: string; ar: string; gloss: string };

/** Real Semitic kin of a triliteral, spoken in Hebrew and Arabic when the root is known. */
export const COGNATES: Record<string, Cognate> = {
  "ܐܡܪ": { he: "אָמַר", ar: "أَمَرَ", gloss: "say / command" },
  "ܟܬܒ": { he: "כָּתַב", ar: "كَتَبَ", gloss: "write" },
  "ܡܠܟ": { he: "מָלַךְ", ar: "مَلَكَ", gloss: "reign" },
  "ܫܡܥ": { he: "שָׁמַע", ar: "سَمِعَ", gloss: "hear" },
  "ܫܠܡ": { he: "שָׁלַם", ar: "سَلِمَ", gloss: "be whole" },
  "ܚܝܐ": { he: "חָיָה", ar: "حَيِيَ", gloss: "live" },
  "ܩܕܫ": { he: "קָדַשׁ", ar: "قَدُسَ", gloss: "be holy" },
  "ܥܒܕ": { he: "עָבַד", ar: "عَبَدَ", gloss: "serve, do" },
  "ܢܦܫ": { he: "נֶפֶשׁ", ar: "نَفْس", gloss: "soul" },
  "ܪܘܚ": { he: "רוּחַ", ar: "رُوح", gloss: "spirit, wind" },
  "ܐܪܥ": { he: "אֶרֶץ", ar: "أَرْض", gloss: "earth" },
  "ܫܡܝ": { he: "שָׁמַיִם", ar: "سَمَاء", gloss: "heaven" },
  "ܝܘܡ": { he: "יוֹם", ar: "يَوْم", gloss: "day" },
  "ܡܝܐ": { he: "מַיִם", ar: "مَاء", gloss: "water" },
  "ܠܚܡ": { he: "לֶחֶם", ar: "لَحْم", gloss: "bread / flesh" },
  "ܐܒ": { he: "אָב", ar: "أَب", gloss: "father" },
  "ܐܚ": { he: "אָח", ar: "أَخ", gloss: "brother" },
  "ܫܡ": { he: "שֵׁם", ar: "اِسْم", gloss: "name" },
  "ܒܝܬ": { he: "בַּיִת", ar: "بَيْت", gloss: "house" },
  "ܡܠܐ": { he: "מָלֵא", ar: "مَلَأَ", gloss: "fill" },
  "ܩܪܐ": { he: "קָרָא", ar: "قَرَأَ", gloss: "call, read" },
  "ܝܗܒ": { he: "יָהַב", ar: "وَهَبَ", gloss: "give" },
  "ܐܬܐ": { he: "אָתָה", ar: "أَتَى", gloss: "come" },
  "ܩܕܡ": { he: "קָדַם", ar: "قَدُمَ", gloss: "be before" },
  "ܒܪܟ": { he: "בָּרַךְ", ar: "بَارَكَ", gloss: "bless" },
  "ܕܡܐ": { he: "דָּם", ar: "دَم", gloss: "blood" },
  "ܐܢܫ": { he: "אֱנוֹשׁ", ar: "إِنْسَان", gloss: "man" },
};

function lookup(token: string): Say | undefined {
  const key = token.toLowerCase().replace(/^[“"']|[”"'.:,;]+$/g, "");
  if (!key || SKIP.has(key)) return SKIP.has(key) ? SAY.the : undefined;
  return SAY[key];
}

/** How to say a gloss in one of the open languages. Empty when the gloss is not settled. */
export function sayGloss(gloss: string, lang: LangId): string {
  const whole = lookup(gloss.trim());
  if (whole && whole[lang]) return whole[lang];
  const tokens = gloss.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  const said: string[] = [];
  let known = 0;
  let needed = 0;
  for (const token of tokens) {
    const bare = token.replace(/^[“"']|[”"'.:,;]+$/g, "");
    if (!bare) continue;
    if (SKIP.has(bare.toLowerCase())) continue;
    needed += 1;
    const hit = lookup(bare);
    const word = hit?.[lang];
    if (!word) continue;
    known += 1;
    said.push(word);
  }
  if (!needed || known < needed) return "";
  return lang === "zh" || lang === "ja" ? said.join("") : said.join(" ");
}
