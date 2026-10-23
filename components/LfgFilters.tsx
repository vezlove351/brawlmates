"use client";

import { LFG_LANGUAGES, LFG_MODES, TROPHY_BRACKETS } from "@/lib/lfg";

export interface LfgFilterValues {
  mode: string;
  bracket: string;
  language: string;
}

// Фильтры ленты: три компактных выпадающих списка в ряд.
export function LfgFilters({
  value,
  onChange,
}: {
  value: LfgFilterValues;
  onChange: (v: LfgFilterValues) => void;
}) {
  const selectClass =
    "min-w-0 flex-1 rounded-xl bg-tg-secondary-bg px-2 py-2 text-sm font-semibold outline-none";

  return (
    <div className="flex gap-2">
      <select
        aria-label="Режим"
        className={selectClass}
        value={value.mode}
        onChange={(e) => onChange({ ...value, mode: e.target.value })}
      >
        <option value="">🎮 Режим</option>
        {LFG_MODES.filter((m) => m.id !== "any").map((m) => (
          <option key={m.id} value={m.id}>
            {m.emoji} {m.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Трофеи автора"
        className={selectClass}
        value={value.bracket}
        onChange={(e) => onChange({ ...value, bracket: e.target.value })}
      >
        {TROPHY_BRACKETS.map((b) => (
          <option key={b.id} value={b.id}>
            🏆 {b.id === "any" ? "Любые" : b.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Язык"
        className={selectClass}
        value={value.language}
        onChange={(e) => onChange({ ...value, language: e.target.value })}
      >
        <option value="">🌐 Язык</option>
        {LFG_LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
