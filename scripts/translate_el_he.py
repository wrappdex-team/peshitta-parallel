#!/usr/bin/env python3
"""Contemporary Greek and Hebrew of this Peshitta edition. Resumable.

The source is the edition's English, which follows the Syriac, not a later
Greek printed text. Names of people, places, and the kept Semitic words stay
in their original form. The sentences are contemporary, not Koine and not
biblical Hebrew.
"""

import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/workspace")
NT = ROOT / "src/data/nt"
OUT = ROOT / "src/data/tr"
KEY = os.environ["XAI_API_KEY"]
MODEL = os.environ.get("XAI_MODEL", "grok-4.20-0309-non-reasoning")
BATCH = int(os.environ.get("BATCH", "16"))
WORKERS = int(os.environ.get("WORKERS", "6"))

LANGS = ("el", "he")

SYSTEM = """You translate the English of a Peshitta New Testament. The English already follows the Syriac, not the later Greek copies. Translate that sentence. Do not replace it with a more familiar Bible line.

Contemporary speech:
- Greek: modern δημοτική, monotonic, clear and dignified. Not Koine, not katharevousa. εσύ for one person, εσείς for more than one.
- Hebrew: modern Israeli Hebrew, unpointed, clear and dignified. Not biblical Hebrew. No vav-consecutive, no אשר where modern ש fits, no nikud. אתה for one man, אתם for more than one.

Names stay indeclinable and spelled exactly:
Y'shua Ιεσούα / ישוע. Never Ιησούς, never ישו.
Elohim Ελοχίμ / אלוהים. Never Θεός, never אלוה as a substitute for the name (אלוהי is allowed only for "my Elohim").
Mashiyach Μασιάχ / משיח. Never Χριστός.
YHWH Γιαχβέ / יהוה.
Keefa Κεφά / כיפא. Never Πέτρος.
Yochanan Γιοχανάν / יוחנן. Never Ιωάννης.
Urishlim Ουρισλίμ / אורישלים. Never Ιερουσαλήμ, never ירושלים.
Maryam Μαριάμ / מרים. Yosip Γιοσίπ / יוסף. Moshe Μοσέ / משה.
Avraham Αβραάμ / אברהם. Ya'akov Γιακόβ / יעקב. Dawid Δαβίδ / דוד.
Shimon Σιμόν / שמעון. Paulos Παύλος / פאולוס. Shaul Σαούλ / שאול.
Galila Γαλίλα / גלילא. Yisrael Ισραέλ / ישראל. Yehuda Γεχούντα / יהודה.
Yehudaye, Jews, Judeans: Γεχουδαίοι / יהודים.
Ruach Ρουάχ / רוח. Ruach haKodesh Ρουάχ χαΚόντες / רוח הקודש. Never Άγιο Πνεύμα as a replacement.
Sheol Σιόλ / שאול. Satana Σατανά / שטן. Life-Giver Ζωοδότης / נותן החיים.
Master (the title) Κύριος / אדון. Father Πατέρας / אב. Son Υιός / בן.
assembly σύναξη / עדה. church εκκλησία / כנסייה. Never swap those two words.
fellow laborer συνεργάτης / שותף לעבודה. Never שיתוף הפעולה.
mercies that are refreshed: τα ελέη αναπαύθηκαν / רחמי … נרעננו.
messenger άγγελος / מלאך.
Keep "by his hand" / "by the hand" literal: με το χέρι του / בידו. Never δι' αυτού for that phrase.
immerse is εμβαπτίζω / טבל. Never βάπτισμα as a church word.
Where the English says "give life", do not write "save".
Do not add the three heavenly witnesses. Do not drop a line that is present.
Do not add notes. Return only JSON {"t":["...", "..."]} with exactly one string per verse, same order, no verse numbers.

Style, do not repeat these unless they are the verses you were given:
English: In the beginning was the Word, and the Word was with Elohim, and Elohim was the Word.
el: Στην αρχή ήταν ο Λόγος, και ο Λόγος ήταν με τον Ελοχίμ, και ο Ελοχίμ ήταν ο Λόγος.
he: בראשית היה הדבר, והדבר היה עם אלוהים, ואלוהים היה הדבר.

English: Everything was by his hand, and without him not even one thing was that came to be.
el: Τα πάντα έγιναν με το χέρι του, και χωρίς αυτόν δεν έγινε ούτε ένα πράγμα από όσα έγιναν.
he: הכול היה בידו, ובלעדיו לא היה אפילו דבר אחד ממה שהיה.

English: She will bear a son, and she will call his name Y'shua, for he will give life to his people from their sins.
el: Θα γεννήσει γιο, και θα καλέσει το όνομά του Ιεσούα, γιατί αυτός θα δώσει ζωή στο λαό του από τις αμαρτίες τους.
he: היא תלד בן, ותקרא את שמו ישוע, כי הוא ייתן חיים לעמו מחטאיהם.

English: Give us our needful bread this day.
el: Δώσε μας σήμερα τον άρτο της ανάγκης μας.
he: תן לנו היום את לחם צרכנו.

English: And forgive us our debts, as we also forgive our debtors.
el: Και συγχώρεσέ μας τα χρέη μας, όπως κι εμείς συγχωρούμε τους χρεώστες μας.
he: וסלח לנו את חובותינו, כפי שגם אנחנו סולחים לחייבים שלנו.
"""

# Longest first. Hebrew Elohim accepts אלוהי ("my Elohim") as well as אלוהים.
GUARDS = [
    ("Y'shua", {"el": "Ιεσούα", "he": "ישוע"}),
    ("Elohim", {"el": "Ελοχίμ", "he": "אלוה"}),
    ("Mashiyach", {"el": "Μασιάχ", "he": "משיח"}),
    ("YHWH", {"el": "Γιαχβέ", "he": "יהוה"}),
    ("Keefa", {"el": "Κεφά", "he": "כיפא"}),
    ("Yochanan", {"el": "Γιοχανάν", "he": "יוחנן"}),
    ("Urishlim", {"el": "Ουρισλίμ", "he": "אורישלים"}),
    ("Maryam", {"el": "Μαριάμ", "he": "מרים"}),
    ("haKodesh", {"el": "Κόντ", "he": "קודש"}),
    ("Ruach", {"el": "Ρουάχ", "he": "רוח"}),
    ("Sheol", {"el": "Σιόλ", "he": "שאול"}),
    ("Moshe", {"el": "Μοσέ", "he": "משה"}),
    ("Avraham", {"el": "Αβραάμ", "he": "אברהם"}),
    ("Ya'akov", {"el": "Γιακ", "he": "יעקב"}),
    ("Galila", {"el": "Γαλιλ", "he": "גלילא"}),
    ("Yosip", {"el": "Γιοσίπ", "he": "יוסף"}),
]

FORBIDDEN = {
    "el": ["Ιησού", "Χριστ", "Θεός", "Θεού", "Θεόν", "Θεῷ", "Θεέ", "Ιερουσαλήμ", "Ιωάνν", "Πέτρο"],
    "he": ["כריסטוס", "ישוע"],  # placeholder, real check is regex below
}

# Verse locks for lines where the Peshitta and the familiar Greek parting is the point.
# Applied after generation. Keys are book.chapter.verse (1-based verse number).
LOCKED = {
    "john.1.1": {
        "el": "Στην αρχή ήταν ο Λόγος, και ο Λόγος ήταν με τον Ελοχίμ, και ο Ελοχίμ ήταν ο Λόγος.",
        "he": "בראשית היה הדבר, והדבר היה עם אלוהים, ואלוהים היה הדבר.",
    },
    "john.1.3": {
        "el": "Τα πάντα έγιναν με το χέρι του, και χωρίς αυτόν δεν έγινε ούτε ένα πράγμα από όσα έγιναν.",
        "he": "הכול היה בידו, ובלעדיו לא היה אפילו דבר אחד ממה שהיה.",
    },
    "john.1.14": {
        "el": "Και ο Λόγος έγινε σάρκα και κατασκήνωσε ανάμεσά μας, και είδαμε τη δόξα του, δόξα ως του Μονογενούς από τον Πατέρα, γεμάτη χάρη και αλήθεια.",
        "he": "והדבר היה לבשר ושכן בתוכנו, וראינו את כבודו, כבוד כיחיד מן האב, מלא חסד ואמת.",
    },
    "john.3.16": {
        "el": "Γιατί ο Ελοχίμ τόσο αγάπησε τον κόσμο, ώστε έδωσε τον μονάκριβο Υιό του, για να μη χαθεί όποιος πιστεύει σε αυτόν, αλλά να έχει ζωή για πάντα.",
        "he": "כי כך אהב אלוהים את העולם, עד שנתן את בנו יחידו, כדי שכל מי שמאמין בו לא יאבד, אלא יהיו לו חיים לעולם.",
    },
    "john.8.58": {
        "el": "Ο Ιεσούα τους είπε: Αμήν, αμήν, σας λέω, πριν γίνει ο Αβραάμ, εγώ είμαι.",
        "he": "ישוע אמר להם: אמן, אמן, אני אומר לכם, בטרם היה אברהם, אני הוא.",
    },
    "john.19.30": {
        "el": "Όταν ο Ιεσούα πήρε το ξίδι, είπε: Κοίτα, τελείωσε. Και έσκυψε το κεφάλι και παρέδωσε το πνεύμα του.",
        "he": "כשישוע לקח את החומץ, אמר: הנה, הושלם. והרכין את ראשו ומסר את רוחו.",
    },
    "john.20.28": {
        "el": "Και ο Τομά αποκρίθηκε και του είπε: Ο Κύριός μου και ο Ελοχίμ μου!",
        "he": "ותומא ענה ואמר לו: אדוני ואלוהי!",
    },
    "matthew.1.1": {
        "el": "Το βιβλίο της γέννησης του Ιεσούα του Μασιάχ, του γιου του Δαβίδ, του γιου του Αβραάμ.",
        "he": "ספר לידתו של ישוע המשיח, בן דוד בן אברהם.",
    },
    "matthew.1.16": {
        "el": "Ο Γιακόβ γέννησε τον Γιοσίπ, τον άντρα της Μαριάμ, από την οποία γεννήθηκε ο Ιεσούα, που λέγεται Μασιάχ.",
        "he": "יעקב הוליד את יוסף, בעלה של מרים, שממנה נולד ישוע שנקרא משיח.",
    },
    "matthew.1.21": {
        "el": "Θα γεννήσει γιο, και θα καλέσει το όνομά του Ιεσούα, γιατί αυτός θα δώσει ζωή στο λαό του από τις αμαρτίες τους.",
        "he": "היא תלד בן, ותקרא את שמו ישוע, כי הוא ייתן חיים לעמו מחטאיהם.",
    },
    "matthew.1.23": {
        "el": "Μια παρθένα θα συλλάβει και θα γεννήσει γιο, και θα καλέσουν το όνομά του Αμμανουήλ, που ερμηνεύεται: Ο Ελοχίμ μας μαζί μας.",
        "he": "בתולה תהרה ותלד בן, ויקראו את שמו עמנואל, שפירושו: אלוהינו איתנו.",
    },
    "matthew.6.9": {
        "el": "Έτσι, λοιπόν, προσεύχεστε: Πατέρα μας που είσαι στους ουρανούς, ας αγιαστεί το όνομά σου.",
        "he": "כך, אפוא, התפללו: אבינו שבשמיים, יתקדש שמך.",
    },
    "matthew.6.11": {
        "el": "Δώσε μας σήμερα τον άρτο της ανάγκης μας.",
        "he": "תן לנו היום את לחם צרכנו.",
    },
    "matthew.6.12": {
        "el": "Και συγχώρεσέ μας τα χρέη μας, όπως κι εμείς συγχωρούμε τους χρεώστες μας.",
        "he": "וסלח לנו את חובותינו, כפי שגם אנחנו סולחים לחייבים שלנו.",
    },
    "matthew.6.13": {
        "el": "Και μη μας φέρεις σε δοκιμασία, αλλά λύτρωσέ μας από τον πονηρό, γιατί δική σου είναι η βασιλεία και η δύναμη και η δόξα εις τον αιώνα των αιώνων.",
        "he": "ואל תביא אותנו לידי ניסיון, אלא הציל אותנו מן הרע, כי לך המלכות והכוח והכבוד לעולם עולמים.",
    },
    "matthew.16.18": {
        "el": "Κι εγώ σου λέω ότι εσύ είσαι Κεφά, και πάνω σε αυτή την κεφά θα χτίσω τη σύναξή μου, και οι πύλες του Σιόλ δεν θα υπερισχύσουν εναντίον της.",
        "he": "וגם אני אומר לך: אתה כיפא, ועל הכיפא הזאת אבנה את עדתי, ושערי שאול לא יגברו עליה.",
    },
    "matthew.28.19": {
        "el": "Πηγαίνετε λοιπόν και κάντε μαθητές όλα τα έθνη, και εμβαπτίστε τους στο όνομα του Πατέρα και του Υιού και της Ρουάχ χαΚόντες.",
        "he": "לכו אפוא ועשו תלמידים מכל הגויים, והטבילו אותם בשם האב והבן ורוח הקודש.",
    },
    "luke.23.34": {
        "el": "Ο Ιεσούα όμως έλεγε: Πατέρα, συγχώρεσέ τους, γιατί δεν ξέρουν τι κάνουν. Και μοίρασαν τα ρούχα του και έβαλαν κλήρο πάνω τους.",
        "he": "אבל ישוע היה אומר: אבא, סלח להם, כי אינם יודעים מה הם עושים. וחילקו את בגדיו והפילו עליהם גורל.",
    },
    "luke.23.43": {
        "el": "Ο Ιεσούα του είπε: Αμήν σου λέω, ότι σήμερα θα είσαι μαζί μου στον παράδεισο.",
        "he": "ישוע אמר לו: אמן אני אומר לך, שהיום תהיה איתי בפרדס.",
    },
    "acts.2.38": {
        "el": "Ο Σιμόν τους είπε: Επιστρέψτε, και ας εμβαπτιστεί ο καθένας σας στο όνομα του Κυρίου Γιαχβέ Ιεσούα για τη συγχώρεση των αμαρτιών, ώστε να λάβετε τη δωρεά της Ρουάχ χαΚόντες.",
        "he": "שמעון אמר להם: חזרו בתשובה, ויטבל כל אחד מכם בשם האדון יהוה ישוע לסליחת החטאים, כדי שתקבלו את מתנת רוח הקודש.",
    },
    "philippians.2.6": {
        "el": "ο οποίος, ενώ ήταν σε ομοίωμα Ελοχίμ, δεν θεώρησε αρπαγή το ότι είναι ίσος με τον Ελοχίμ,",
        "he": "אשר בהיותו בדמות אלוהים לא חשב זאת לגזלה שהוא שווה לאלוהים,",
    },
    "1john.4.8": {
        "el": "Γιατί ο Ελοχίμ είναι αγάπη, και όποιος δεν αγαπά δεν γνωρίζει τον Ελοχίμ.",
        "he": "כי אלוהים הוא אהבה, וכל מי שאינו אוהב אינו מכיר את אלוהים.",
    },
    "2john.1.7": {
        "el": "Επειδή πολλοί πλάνοι βγήκαν στον κόσμο, αυτοί που δεν ομολογούν ότι ο Ιεσούα ο Μασιάχ ήρθε στη σάρκα. Αυτός είναι πλάνος και αντι-Μασιάχ.",
        "he": "כי רבים מרמים יצאו לעולם, אלה שאינם מודים שישוע המשיח בא בבשר. זהו מרמה ואנטי-משיח.",
    },
    "1john.5.7": {
        "el": "Και το Πνεύμα μαρτυρεί ότι το Πνεύμα είναι η αλήθεια.",
        "he": "והרוח מעידה שהרוח היא האמת.",
    },
}


def clean(en: str) -> str:
    return " ".join(en.replace("‹", "").replace("›", "").split())


def fold(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))


def normalize(lang: str, text: str) -> str:
    text = " ".join(text.split())
    if lang == "he":
        text = re.sub(r"ישו(?!ע)", "ישוע", text)
    return text


def script_ok(lang: str, text: str) -> bool:
    if lang == "el":
        return any("\u0370" <= c <= "\u03ff" for c in text) and not re.search(r"[A-Za-z]{4,}", text)
    return any("\u0590" <= c <= "\u05ff" for c in text) and not re.search(r"[A-Za-z]{4,}", text)


def name_problems(lang: str, source: str, text: str) -> str:
    hay = fold(text).casefold() if lang == "el" else text
    if lang == "he" and re.search(r"ישו(?!ע)", text):
        return "wrote ישו without ע"
    if lang == "el":
        if re.search(r"(?<![α-ω])ιησου", hay):
            return "forbidden ιησου"
        if re.search(r"(?<!αντι)χριστ", hay):
            return "forbidden χριστ"
        if re.search(r"(?<![α-ω])θεος(?![α-ω])|(?<![α-ω])θεου(?![α-ω])|(?<![α-ω])θεον(?![α-ω])", hay):
            return "forbidden θεος"
        if re.search(r"(?<![α-ω])θεω(?!ρ)", hay) or re.search(r"(?<![α-ω])θεε(?![α-ω])", hay):
            return "forbidden θεος"
        for bad in ["ιερουσαλημ", "ιωανν", "πετρος", "πετρου", "πετρον"]:
            if bad in hay:
                return f"forbidden {bad}"
    if re.search(r"\bchurch\b", source, re.I):
        if lang == "el" and "εκκλησ" not in hay:
            return "church must be εκκλησία"
        if lang == "he" and "כנסי" not in text:
            return "church must be כנסייה"
    if re.search(r"\bassembly\b", source, re.I):
        if lang == "el" and "συναξ" not in hay:
            return "assembly must be σύναξη"
        if lang == "he" and not re.search(r"עדה|עדתי|העדה", text):
            return "assembly must be עדה"
    if "fellow laborer" in source and lang == "he" and "שותף לעבודה" not in text and "עמית" not in text:
        return "fellow laborer must be שותף לעבודה"
    if "Life-Giver" in source:
        if lang == "el" and "ζωοδοτ" not in hay:
            return "Life-Giver must be Ζωοδότης"
        if lang == "he" and "נותן" not in text and "מחי" not in text:
            return "Life-Giver must be נותן החיים"
    if "Shimon" in source:
        if lang == "el" and "σιμ" not in hay and "σιμων" not in hay:
            return "Shimon must be Σιμόν"
        if lang == "he" and "שמעון" not in text:
            return "Shimon must be שמעון"
    for needle, need in GUARDS:
        if needle in source and (fold(need[lang]).casefold() if lang == "el" else need[lang]) not in hay:
            return f"missing {need[lang]} for {needle}"
    return ""


def good(lang: str, text: str, source: str) -> str:
    if not text or text.strip().lower() == source.strip().lower():
        return "empty or copied English"
    if not script_ok(lang, text):
        return "wrong script"
    return name_problems(lang, source, text)


def parse_t(content: str, n: int):
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    data = json.loads(text)
    rows = data["t"] if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise ValueError(f"got {type(rows)} want {n}")
    rows = [str(row).strip() for row in rows]
    if len(rows) != n:
        compact = [row for row in rows if row]
        if len(compact) == n:
            rows = compact
        elif n == 1 and compact:
            rows = [" ".join(compact)]
        else:
            raise ValueError(f"got {len(rows)} want {n}")
    return rows


def chat(lang: str, lines: list[str]) -> list[str]:
    numbered = "\n".join(f"{i + 1}. {line}" for i, line in enumerate(lines))
    hint = ""
    last = "no attempt"
    for attempt in range(4):
        body = json.dumps(
            {
                "model": MODEL,
                "temperature": 0.2,
                "max_tokens": 7000,
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {
                        "role": "user",
                        "content": (
                            ("Modern Greek.\n\n" if lang == "el" else "Modern Hebrew.\n\n")
                            + numbered
                            + hint
                        ),
                    },
                ],
            }
        ).encode()
        req = urllib.request.Request(
            "https://api.x.ai/v1/chat/completions",
            data=body,
            headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                payload = json.loads(res.read())
            content = payload["choices"][0]["message"]["content"]
            rows = [normalize(lang, row) for row in parse_t(content, len(lines))]
            problems = [good(lang, row, src) for row, src in zip(rows, lines)]
            if not any(problems):
                return rows
            last = "; ".join(f"{i + 1}:{p}" for i, p in enumerate(problems) if p)
            hint = "\n\nThe previous attempt failed: " + last + ". Fix only those verses. Keep every name spelling exact."
        except urllib.error.HTTPError as err:
            detail = err.read()[:180]
            last = f"HTTP {err.code} {detail!r}"
            if err.code == 400:
                raise RuntimeError(last)
        except Exception as err:
            last = str(err)
        time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(last)


def load_book(path: Path):
    return json.loads(path.read_text())


def existing(path: Path, chapters: int):
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list) or len(data) != chapters:
        return None
    return data


def save(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    tmp.replace(path)


def apply_locks(lang: str, book: dict, grid):
    for ci, chapter in enumerate(book["chapters"]):
        for vi, verse in enumerate(chapter):
            lock = LOCKED.get(f"{book['id']}.{ci + 1}.{verse['v']}")
            if lock and lock.get(lang):
                grid[ci][vi] = lock[lang]


def translate_book(lang: str, src: Path):
    book = load_book(src)
    chapters = book["chapters"]
    dest = OUT / lang / f"{book['id']}.json"
    done = existing(dest, len(chapters))
    grid = done if done is not None else [[None] * len(ch) for ch in chapters]
    missing = 0
    for ci, chapter in enumerate(chapters):
        if len(grid[ci]) != len(chapter):
            grid[ci] = [None] * len(chapter)
        for vi, verse in enumerate(chapter):
            text = clean(verse.get("en") or "")
            if not text:
                grid[ci][vi] = ""
            elif not isinstance(grid[ci][vi], str) or not grid[ci][vi] or good(lang, grid[ci][vi], text):
                grid[ci][vi] = None
                missing += 1
    apply_locks(lang, book, grid)
    if missing == 0:
        save(dest, grid)
        return book["id"], lang, 0

    for ci, chapter in enumerate(chapters):
        pending = []
        for vi, verse in enumerate(chapter):
            text = clean(verse.get("en") or "")
            if text and not (isinstance(grid[ci][vi], str) and grid[ci][vi]):
                pending.append((vi, text))
        for start in range(0, len(pending), BATCH):
            chunk = pending[start : start + BATCH]
            try:
                rows = chat(lang, [text for _, text in chunk])
            except RuntimeError:
                rows = []
                for _, alone in chunk:
                    try:
                        rows.append(chat(lang, [alone])[0])
                    except RuntimeError as err:
                        print(f"skip {lang} {book['id']} {ci + 1} {err}", flush=True)
                        rows.append("")
            for (vi, src_text), row in zip(chunk, rows):
                if row and not good(lang, row, src_text):
                    grid[ci][vi] = row
            apply_locks(lang, book, grid)
            save(dest, grid)
            print(f"  {lang} {book['id']} ch {ci + 1} +{len(chunk)}", flush=True)
    left = 0
    for ci, chapter in enumerate(chapters):
        for vi, verse in enumerate(chapter):
            text = clean(verse.get("en") or "")
            if text and not (isinstance(grid[ci][vi], str) and grid[ci][vi]):
                left += 1
    save(dest, grid)
    return book["id"], lang, left


def main():
    only = [item for item in os.environ.get("ONLY", "el,he").split(",") if item in LANGS]
    want = {item for item in os.environ.get("BOOK", "").split(",") if item}
    books = sorted(NT.glob("*.json"), key=lambda p: p.stat().st_size)
    if want:
        books = [p for p in books if p.stem in want]
    jobs = [(lang, src) for src in books for lang in only]
    print(f"jobs {len(jobs)} workers {WORKERS} model {MODEL}", flush=True)
    failed = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(translate_book, lang, src): (lang, src.name) for lang, src in jobs}
        for fut in as_completed(futures):
            lang, name = futures[fut]
            try:
                book_id, lang, left = fut.result()
                print(f"done {lang} {book_id} still {left}", flush=True)
                if left:
                    failed.append((lang, name, f"still {left}"))
            except Exception as err:
                failed.append((lang, name, str(err)))
                print(f"FAIL {lang} {name} {err}", flush=True)
    print(f"finished failed {len(failed)}", flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
