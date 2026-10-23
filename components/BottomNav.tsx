"use client";

import { useEffect } from "react";

export type Section = "profile" | "lfg" | "settings";

const ITEMS: { value: Section; label: string; emoji: string }[] = [
  { value: "profile", label: "Профиль", emoji: "👤" },
  { value: "lfg", label: "Тиммейты", emoji: "🤝" },
  { value: "settings", label: "Настройки", emoji: "⚙️" },
];

// Нижняя панель разделов, как в обычных приложениях.
export function BottomNav({ value, onChange }: { value: Section; onChange: (s: Section) => void }) {
  // Панель закреплена поверх страницы — добавляем снизу отступ,
  // чтобы она не закрывала конец страницы (в том числе строку про Supercell).
  useEffect(() => {
    document.body.style.paddingBottom = "calc(72px + env(safe-area-inset-bottom))";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, []);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-tg-hint/20 bg-tg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md">
        {ITEMS.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              onClick={() => onChange(item.value)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold ${
                active ? "text-tg-button" : "text-tg-hint"
              }`}
            >
              <span className="text-xl">{item.emoji}</span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
