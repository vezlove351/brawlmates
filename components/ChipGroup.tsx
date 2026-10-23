"use client";

interface ChipGroupProps<T extends string | number> {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}

// Набор кнопок-вариантов, из которых выбирается один.
export function ChipGroup<T extends string | number>({ options, value, onChange }: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
              active ? "bg-tg-button text-tg-button-text" : "bg-tg-bg text-tg-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
