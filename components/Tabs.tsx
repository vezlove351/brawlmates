"use client";

interface TabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "sm";
}

// Переключатель вкладок (и сортировки) в стиле Telegram.
export function Tabs<T extends string>({ options, value, onChange, size = "md" }: TabsProps<T>) {
  return (
    <div className="flex gap-1 rounded-xl bg-tg-secondary-bg p-1" role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg font-semibold transition-colors ${
              size === "sm" ? "px-2 py-1.5 text-sm" : "px-3 py-2"
            } ${active ? "bg-tg-button text-tg-button-text" : "text-tg-hint"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
