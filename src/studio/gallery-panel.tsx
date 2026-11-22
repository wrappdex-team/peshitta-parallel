import { useEffect, useState } from "react";
import { deleteWork, listWorks, type Work } from "./gallery.ts";
import { ResultCard } from "./result.tsx";

type Filter = "all" | "still" | "song" | "film";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "still", label: "Stills" },
  { id: "song", label: "Songs" },
  { id: "film", label: "Films" },
];

/** Everything this device has made, newest first. Nothing here leaves the device. */
export function GalleryPanel() {
  const [works, setWorks] = useState<(Work & { src: string })[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let urls: string[] = [];
    let live = true;
    void listWorks().then((rows) => {
      if (!live) return;
      const shown = rows.map((row) => {
        const src = row.blob ? URL.createObjectURL(row.blob) : (row.url ?? "");
        if (row.blob) urls.push(src);
        return { ...row, src };
      });
      setWorks(shown);
    });
    return () => {
      live = false;
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
    };
  }, []);

  async function remove(id: string) {
    if (await deleteWork(id)) setWorks((rows) => rows?.filter((row) => row.id !== id) ?? null);
  }

  if (!works) return <p className="text-sm text-muted">Opening your gallery…</p>;
  const shown = works.filter((row) => filter === "all" || row.kind === filter || (filter === "song" && row.kind === "voice"));
  return (
    <div data-studio-gallery="">
      <p className="text-sm text-muted">Kept on this device only. Clearing the site's data removes it.</p>
      <div role="radiogroup" aria-label="Show" className="mt-2 flex flex-wrap">
        {FILTERS.map((row) => (
          <button key={row.id} type="button" role="radio" aria-checked={filter === row.id} onClick={() => setFilter(row.id)} className={`min-h-11 px-2 text-sm ${filter === row.id ? "text-garnet underline underline-offset-4" : "text-muted"}`}>{row.label}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 font-serif text-lg text-muted">Nothing here yet. What you make appears here.</p>
      ) : (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {shown.map((row) => (
            <li key={row.id} className="grid gap-1">
              <ResultCard output={row} />
              <button type="button" className="min-h-11 justify-self-start px-1 text-sm text-muted" onClick={() => void remove(row.id)}>Delete from this device</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
