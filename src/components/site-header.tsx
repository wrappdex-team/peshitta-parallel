import { SearchPanel } from "@/components/search-panel";
import { InfoMark } from "@/components/info-mark";
import { usePrefs } from "@/lib/use-prefs";
import { Link } from "@tanstack/react-router";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

let openSearch = () => {};

/** Lets a control outside the header open the same search sheet. */
export function requestSearch() {
  openSearch();
}

export function SiteHeader({
  title,
  subtitle,
  wide = false,
  onBooks,
  mark,
  book,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  onBooks?: () => void;
  mark?: string;
  book?: string;
  children?: ReactNode;
}) {
  const { prefs, patch } = usePrefs();
  const [search, setSearch] = useState(false);
  const width = wide ? "max-w-6xl" : "max-w-3xl";

  useEffect(() => {
    openSearch = () => setSearch(true);
    return () => {
      openSearch = () => {};
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper pt-safe">
        <div className={`mx-auto flex items-center justify-between px-2 py-1 ${width}`}>
          {onBooks ? (
            <button type="button" className="ink-icon flex size-11 items-center justify-center" aria-label="Books" onClick={onBooks}>
              <Menu className="size-5" />
            </button>
          ) : (
            <Link to="/" className="ink-icon flex size-11 items-center justify-center" aria-label="All books">
              <Menu className="size-5" />
            </Link>
          )}
          <div className="min-w-0 px-2 text-center">
            <h1 className="flex items-center justify-center gap-1 truncate font-serif text-lg leading-tight">
              {title}
              {mark ? <InfoMark id={mark} /> : null}
            </h1>
            {subtitle ? <span className="block truncate text-xs text-gold">{subtitle}</span> : null}
          </div>
          <div className="flex">
            <button type="button" className="ink-icon flex size-11 items-center justify-center" aria-label="Search" onClick={() => setSearch(true)}>
              <Search className="size-5" />
            </button>
            <button
              type="button"
              className="ink-icon flex size-11 items-center justify-center"
              aria-label={prefs.theme === "night" ? "Day theme" : "Night theme"}
              onClick={() => patch({ theme: prefs.theme === "night" ? "day" : "night" })}
            >
              {prefs.theme === "night" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>
        {children ? <div className={`mx-auto ${width}`}>{children}</div> : null}
      </header>
      <SearchPanel open={search} onClose={() => setSearch(false)} book={book} />
    </>
  );
}
