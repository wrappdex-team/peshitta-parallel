#!/usr/bin/env python3
"""Study translations of Murdock's Peshitta English. Resumable."""

import json
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/workspace")
NT = ROOT / "src/data/nt"
OUT = ROOT / "src/data/tr"
KEY = os.environ["XAI_API_KEY"]
MODEL = "grok-4.20-0309-non-reasoning"
BATCH = 24
WORKERS = 8

LANGS = {
    "es": "Spanish of Spain. Use tú for one person and vosotros for more than one. God is Dios, Jesus is Jesús, Messiah is Mesías.",
    "zh": "Simplified Chinese. Do not imitate the Chinese Union Version. God is 上帝, Jesus is 耶稣, Messiah is 弥赛亚. If the English says hand, keep 手.",
    "de": "Modern dignified German. Use du for one person and ihr for more than one. God is Gott, Jesus is Jesus, Messiah is Messias.",
    "ja": "Modern literary Japanese in である style. God is 神, Jesus is イエス, Messiah is メシア. Keep a singular and a plural you distinct.",
    "aii": "Modern Assyrian Neo-Aramaic (Sureth), Eastern dialect, in vocalized Syriac Unicode a speaker would say today. Do not copy the classical Peshitta spelling.",
    "ar": "Modern clear Arabic (fusḥā). Do not copy the Van Dyck Bible. God / Elohim is الله, Jesus / Y'shua is يسوع, Messiah / Mashiyach is المسيح. Keep “by his hand” as بيده. Right-to-left Arabic script only.",
    "fr": "Modern dignified French. Do not copy Louis Segond. Use tu for one person and vous for more than one. God / Elohim is Dieu, Jesus / Y'shua is Jésus, Messiah / Mashiyach is Messie.",
    "ru": "Modern dignified Russian. Do not copy the Synodal translation. Use ты for one person and вы for more than one. God / Elohim is Бог, Jesus / Y'shua is Иисус, Messiah / Mashiyach is Мессия.",
}

SYSTEM = """You translate James Murdock's 1851 English, which follows the Syriac Peshitta, not the Greek.
Translate the sentence he wrote. Do not replace it with a more familiar Bible line.
Keep every odd turn: "by his hand", "God was the Word", a life-giver, one who is sent.
Do not add notes. Return only JSON {"t":["...", "..."]} with exactly one string per verse, same order, no verse numbers.

Style, do not repeat these unless they are the verses you were given:
English: In the beginning was the Word, and the Word was with God, and God was the Word.
es: En el principio era la Palabra, y la Palabra estaba con Dios, y Dios era la Palabra.
zh: 起初有道，道与上帝同在，上帝就是道。
de: Im Anfang war das Wort, und das Wort war bei Gott, und Gott war das Wort.
ja: 初めに言葉があった。言葉は神と共にあり、神が言葉であった。
aii: ܒܫܘܼܪܵܝܵܐ ܐܝܼܬ ܗ݇ܘܵܐ ܡܸܠܬܵܐ، ܘܡܸܠܬܵܐ ܐܝܼܬ ܗ݇ܘܵܐ ܠܟܸܣ ܐܲܠܵܗܵܐ، ܘܐܲܠܵܗܵܐ ܐܝܼܬ ܗ݇ܘܵܐ ܡܸܠܬܵܐ.
ar: في البدء كانت الكلمة، والكلمة كانت عند الله، والله كان الكلمة.
fr: Au commencement était la Parole, et la Parole était avec Dieu, et Dieu était la Parole.
ru: В начале было Слово, и Слово было у Бога, и Бог был Словом.

English: And by his hand everything was, and without him there was not one thing that was.
es: Y por su mano todo fue, y sin él no hubo ni una sola cosa de lo que fue.
zh: 一切都是藉着他的手而有的；没有他，已有的没有一样。
de: Und durch seine Hand war alles, und ohne ihn war nicht ein Ding von dem, was war.
ja: そして彼の手によって一切があった。彼なしには、あったものは一つもなかった。
aii: ܘܒܐܝܼܕܹܗ ܟܠ ܡܸܢܕܝܼ ܗ݇ܘܹܐ ܠܹܗ، ܘܒܘܼܠܵܐ ܡܸܢܹܗ ܠܵܐ ܗ݇ܘܹܐ ܠܹܗ ܐܦ ܚܲܕ ܡܸܢܕܝܼ ܕܗ݇ܘܹܐ ܠܹܗ.
ar: وبيده كان كل شيء، وبدونه لم يكن شيء واحد مما كان.
fr: Et par sa main tout fut, et sans lui pas même une seule chose ne fut de ce qui était.
ru: И его рукой было всё, и без него не было ни одной вещи из того, что было.
"""


def clean(en: str) -> str:
    return " ".join(en.replace("‹", "").replace("›", "").split())


def good(lang: str, text: str, source: str = "") -> bool:
    if len(text) < 1:
        return False
    if source and text.strip().lower() == source.strip().lower():
        return False
    if lang == "zh":
        return any("\u4e00" <= c <= "\u9fff" for c in text)
    if lang == "ja":
        return any("\u3040" <= c <= "\u30ff" or "\u4e00" <= c <= "\u9fff" for c in text)
    if lang == "aii":
        return any("\u0700" <= c <= "\u074f" for c in text)
    if lang == "ar":
        return any("\u0600" <= c <= "\u06ff" for c in text)
    if lang == "ru":
        return any("\u0400" <= c <= "\u04ff" for c in text)
    if lang == "fr":
        letters = [c for c in text if c.isalpha()]
        return len(letters) >= 2
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 2:
        return False
    return True


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
    body = json.dumps(
        {
            "model": MODEL,
            "temperature": 0.2,
            "max_tokens": 8000,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": LANGS[lang] + "\n\n" + numbered},
            ],
        }
    ).encode()
    last = "no attempt"
    for attempt in range(4):
        req = urllib.request.Request(
            "https://api.x.ai/v1/chat/completions",
            data=body,
            headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                payload = json.loads(res.read())
            content = payload["choices"][0]["message"]["content"]
            rows = parse_t(content, len(lines))
            if all(good(lang, row, src) for row, src in zip(rows, lines)):
                return rows
            last = "failed the language check"
        except urllib.error.HTTPError as err:
            last = f"HTTP {err.code}"
            if err.code not in (429, 500, 503):
                detail = err.read()[:200]
                last = f"HTTP {err.code} {detail!r}"
                if err.code == 400:
                    raise RuntimeError(last)
        except Exception as err:
            last = str(err)
        time.sleep(1.5 * (attempt + 1))
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
            elif not isinstance(grid[ci][vi], str) or not grid[ci][vi]:
                missing += 1
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
                for alone_i, alone_text in chunk:
                    try:
                        rows.append(chat(lang, [alone_text])[0])
                    except RuntimeError as err:
                        print(f"skip {lang} {book['id']} {ci}:{alone_i} {err}", flush=True)
                        rows.append("")
            for (vi, _), row in zip(chunk, rows):
                if row:
                    grid[ci][vi] = row
            save(dest, grid)
    return book["id"], lang, missing


def main():
    only = [item for item in os.environ.get("ONLY", "ar,fr,ru").split(",") if item in LANGS]
    books = sorted(NT.glob("*.json"), key=lambda p: p.stat().st_size)
    jobs = [(lang, src) for src in books for lang in only]
    print(f"jobs {len(jobs)} workers {WORKERS}", flush=True)
    failed = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(translate_book, lang, src): (lang, src.name) for lang, src in jobs}
        for fut in as_completed(futures):
            lang, name = futures[fut]
            try:
                book_id, lang, missing = fut.result()
                print(f"done {lang} {book_id} filled {missing}", flush=True)
            except Exception as err:
                failed.append((lang, name, str(err)))
                print(f"FAIL {lang} {name} {err}", flush=True)
    print(f"finished failed {len(failed)}", flush=True)
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
