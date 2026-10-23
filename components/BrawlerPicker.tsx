"use client";

import { useState } from "react";
import type { PlayerBrawler } from "@/lib/brawlstars";
import { BrawlerIcon } from "./BrawlerIcon";

const SHOW_FIRST = 12;

interface BrawlerPickerProps {
  brawlers: PlayerBrawler[]; // уже отсортированы по трофеям
  selected: number[];
  max: number;
  onChange: (ids: number[]) => void;
}

// Выбор 1–3 своих бравлеров. Сначала показываем самых прокачанных.
export function BrawlerPicker({ brawlers, selected, max, onChange }: BrawlerPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? brawlers : brawlers.slice(0, SHOW_FIRST);

  function toggle(id: number) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-6 gap-1.5">
        {visible.map((b) => {
          const isSelected = selected.includes(b.id);
          const isBlocked = !isSelected && selected.length >= max;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              disabled={isBlocked}
              title={b.name}
              className={`relative rounded-lg transition-opacity ${isBlocked ? "opacity-30" : ""} ${
                isSelected ? "ring-3 ring-tg-button" : ""
              }`}
            >
              <BrawlerIcon id={b.id} name={b.name} size={56} className="aspect-square w-full rounded-lg" />
              {isSelected && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tg-button text-xs font-bold text-tg-button-text">
                  {selected.indexOf(b.id) + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {brawlers.length > SHOW_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start text-sm font-semibold text-tg-link"
        >
          {showAll ? "Свернуть" : `Показать всех (${brawlers.length})`}
        </button>
      )}
    </div>
  );
}
