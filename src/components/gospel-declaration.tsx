import { Modal } from "@/components/modal";
import { NameSeal } from "@/components/name-seal";
import { declarationPng } from "@/lib/declaration-card";
import {
  DECLARATION,
  EMPTY_DECLARATION,
  clampName,
  declarationShareText,
  dismissDeclaration,
  gospelProgress,
  keepDeclaration,
  longDate,
  readDeclaration,
  todayIso,
  type Declaration,
} from "@/lib/declaration";
import { useReadings } from "@/lib/readings";
import { SHARE_ORIGIN, shareCard } from "@/lib/share";
import { readingSessionLive, subscribeReadingLive } from "@/lib/speech-lock";
import { useEffect, useRef, useState } from "react";

const SHEET = "fixed inset-0 z-50 flex items-stretch justify-center bg-scrim sm:items-center sm:px-4 sm:py-6";

export function GospelOffer() {
  const { counts, ready } = useReadings();
  const [record, setRecord] = useState<Declaration>(EMPTY_DECLARATION);
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(false);
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    const pull = () => setRecord(readDeclaration());
    pull();
    window.addEventListener("injeel-declaration", pull);
    return () => window.removeEventListener("injeel-declaration", pull);
  }, []);

  useEffect(() => {
    const pull = () => setVoice(readingSessionLive());
    pull();
    return subscribeReadingLive(pull);
  }, []);

  useEffect(() => {
    const show = () => {
      if (!gospelProgress(counts).complete) return;
      setQuiet(false);
      setOpen(true);
    };
    window.addEventListener("injeel-declaration-open", show);
    return () => window.removeEventListener("injeel-declaration-open", show);
  }, [counts]);

  useEffect(() => {
    if (!ready || voice || quiet || readingSessionLive()) return;
    const current = readDeclaration();
    if (gospelProgress(counts).complete && !current.kept && !current.dismissed) setOpen(true);
  }, [ready, counts, voice, quiet]);

  function hush() {
    setQuiet(true);
    setOpen(false);
  }

  return (
    <GospelDeclaration
      open={open}
      record={record}
      onClose={() => setOpen(false)}
      onHush={hush}
    />
  );
}

export function openDeclaration() {
  window.dispatchEvent(new Event("injeel-declaration-open"));
}

function GospelDeclaration({
  open,
  record,
  onClose,
  onHush,
}: {
  open: boolean;
  record: Declaration;
  onClose: () => void;
  onHush: () => void;
}) {
  const [name, setName] = useState(record.name);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<{ key: string; file: File } | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(record.name);
  }, [open, record.name]);

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const date = record.date || todayIso();
  const signed = clampName(name);
  const dated = longDate(date);
  const imageKey = `${signed}\n${date}`;

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    const key = imageKey;
    declarationPng({ name: signed, date })
      .then((blob) => {
        if (!cancel) imageRef.current = { key, file: new File([blob], "injeel-the-four-gospels.png", { type: "image/png" }) };
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [open, imageKey, signed, date]);

  if (!open) return null;

  function readyFile() {
    return imageRef.current?.key === imageKey ? imageRef.current.file : null;
  }

  async function share() {
    setBusy(true);
    setNote("");
    const text = declarationShareText(signed, date);
    const image = readyFile();
    try {
      if (image && typeof navigator.share === "function" && navigator.canShare?.({ files: [image] })) {
        try {
          await navigator.share({ files: [image], title: "I have read the words", text });
          setNote("Sent");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const result = await shareCard({
        title: "I have read the words — Injeel",
        text,
        url: `${SHARE_ORIGIN}/`,
      });
      setNote(result === "shared" ? "Sent" : result === "copied" ? "Copied" : result === "failed" ? "Could not share from this browser." : "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNote("Could not share from this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setNote("");
    try {
      const blob = readyFile() ?? (await declarationPng({ name: signed, date }));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "injeel-the-four-gospels.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setNote("Saved");
    } catch {
      setNote("Could not save the declaration.");
    } finally {
      setBusy(false);
    }
  }

  function keep() {
    keepDeclaration(name, date);
    setNote("Kept on this device.");
  }

  function later() {
    dismissDeclaration();
    onHush();
  }

  return (
    <Modal label="Declaration" className={SHEET} onClose={record.kept ? onClose : onHush}>
      <article
        className="flex h-full w-full max-w-xl flex-col border-gold bg-paper text-ink sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8">
          <div className="flex flex-col items-center text-center">
            <NameSeal />
            <p className="mt-5 text-xs tracking-widest text-gold">THE FOUR GOSPELS</p>
            <p className="mt-2 font-syriac text-3xl text-syriac" lang="syr" dir="rtl">
              ܐܘܢܓܠܝܘܢ
            </p>
            <h2 tabIndex={-1} data-modal-initial className="mt-2 font-serif text-3xl font-semibold tracking-tight outline-none">
              I have read the words
            </h2>
            <p className="mt-2 text-sm text-muted">
              Matthew, Mark, Luke, and John. Read through{dated ? ` on ${dated}` : ""}.
            </p>
            <div className="mt-5 h-px w-16 bg-gold" />
          </div>

          <div className="mt-6 space-y-3 text-left text-base leading-relaxed">
            {DECLARATION.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <label className="mt-8 block">
            <span className="text-xs tracking-widest text-gold">SIGN, IF YOU WISH</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 80))}
              placeholder="Your name"
              autoComplete="name"
              maxLength={80}
              className="mt-2 w-full border-0 border-b border-gold bg-transparent py-2 text-center font-serif text-2xl italic text-ink outline-none placeholder:not-italic placeholder:text-muted"
            />
          </label>
        </div>

        <div className="shrink-0 border-t border-line bg-paper px-5 py-3 pb-safe">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {!record.kept && (
              <button type="button" className="min-h-11 px-2 text-garnet" onClick={keep} disabled={busy}>
                Keep this declaration
              </button>
            )}
            {record.kept && signed !== record.name && (
              <button type="button" className="min-h-11 px-2 text-garnet" onClick={keep} disabled={busy}>
                Keep this name
              </button>
            )}
            {record.kept && (
              <>
                <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => void share()} disabled={busy}>
                  Share
                </button>
                <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => void download()} disabled={busy}>
                  Download
                </button>
              </>
            )}
            <button type="button" className="min-h-11 px-2 text-muted" onClick={record.kept ? onClose : later}>
              {record.kept ? "Close" : "Not now"}
            </button>
          </div>
          {note ? <p className="mt-2 text-center text-sm text-muted">{note}</p> : null}
          <p className="mt-2 text-center text-xs text-muted">The name stays on this device. Nothing is uploaded.</p>
        </div>
      </article>
    </Modal>
  );
}
