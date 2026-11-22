import type { ReactNode } from "react";

export const CUSTOM_STYLE_ID = "custom";
const select = "min-h-11 w-full min-w-0 max-w-full bg-transparent text-ink";

/** One compact, collapsed list of presets plus a Custom style box. */
export function StyleSelect({
  label,
  value,
  options,
  custom,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  custom: string;
  onChange: (id: string, custom?: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <label className="grid min-w-0 text-sm text-muted">
        {label}
        <select aria-label={label} disabled={disabled} className={select} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
          <option value={CUSTOM_STYLE_ID}>Custom style</option>
        </select>
      </label>
      {value === CUSTOM_STYLE_ID && (
        <label className="grid min-w-0 gap-1 text-sm text-muted">
          Your style
          <textarea aria-label="Custom style" rows={3} value={custom} onChange={(event) => onChange(CUSTOM_STYLE_ID, event.target.value)} placeholder="Describe the look you want…" className="w-full min-w-0 whitespace-pre-wrap border border-line bg-raised p-2 text-sm leading-relaxed text-ink" />
        </label>
      )}
    </div>
  );
}

/** Prompt preview, director refine and the other quiet details, closed until opened. */
export function Advanced({ children }: { children: ReactNode }) {
  return (
    <details className="min-w-0" data-studio-advanced="">
      <summary className="min-h-11 cursor-pointer select-none text-sm text-muted">Advanced</summary>
      <div className="grid min-w-0 gap-4 pt-2">{children}</div>
    </details>
  );
}
