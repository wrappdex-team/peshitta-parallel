import { useState } from "react";
import { fileName, labelFor, type Made } from "./prompt.ts";

export type Output = Made & { src: string; mime: string; detail: string; prompt?: string };

function extOf(mime: string) {
  return mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("mp4") ? "mp4" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : "png";
}

/** One made thing, always with its label, a download and (where the browser can) share. */
export function ResultCard({ output }: { output: Output }) {
  const [note, setNote] = useState("");
  const label = labelFor(output);
  const name = fileName(output.ref, output.detail, extOf(output.mime));

  async function share() {
    try {
      const blob = await (await fetch(output.src)).blob();
      const file = new File([blob], name, { type: output.mime });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: output.ref, text: label });
        return;
      }
      setNote("This browser cannot share files. Use Download.");
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError") setNote("Sharing did not work. Use Download.");
    }
  }

  return (
    <figure className="border border-line bg-raised" data-studio-output={output.kind}>
      {output.kind === "still" && <img src={output.src} alt={`${output.detail} still for ${output.ref}, AI-generated`} className="block w-full" />}
      {output.kind === "film" && <video src={output.src} controls playsInline className="block w-full" />}
      {(output.kind === "song" || output.kind === "voice") && <audio src={output.src} controls className="block w-full p-2" />}
      <figcaption className="px-3 py-2 text-xs leading-relaxed text-muted" data-studio-label="">{label}</figcaption>
      <div className="flex flex-wrap border-t border-line px-1 text-sm">
        <a href={output.src} download={name} className="inline-flex min-h-11 items-center px-2 text-garnet">Download</a>
        <button type="button" className="min-h-11 px-2 text-garnet" onClick={() => void share()}>Share</button>
        {note && <span role="status" className="self-center px-2 text-xs text-muted">{note}</span>}
      </div>
    </figure>
  );
}
