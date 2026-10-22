"use client";

import { useMemo, useState } from "react";
import type { PlayerBrawler } from "@/lib/brawlstars";
import { BrawlerCard } from "./BrawlerCard";
import { Tabs } from "./Tabs";

type SortKey = "trophies" | "power" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "trophies", label: "🏆 Трофеи" },
  { value: "power", label: "⚡ Сила" },
  { value: "name", label: "🔤 Имя" },
];

const byTrophies = (a: PlayerBrawler, b: PlayerBrawler) => b.trophies - a.trophies;

const SORTERS: Record<SortKey, (a: PlayerBrawler, b: PlayerBrawler) => number> = {
  trophies: byTrophies,
  // При одинаковой силе выше тот, у кого больше трофеев.
  power: (a, b) => b.power - a.power || byTrophies(a, b),
  name: (a, b) => a.name.localeCompare(b.name),
};

export function BrawlerList({ brawlers }: { brawlers: PlayerBrawler[] }) {
  const [sort, setSort] = useState<SortKey>("trophies");
  const sorted = useMemo(() => [...brawlers].sort(SORTERS[sort]), [brawlers, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Бравлеры</h2>
        <span className="text-sm text-tg-hint">{brawlers.length} шт.</span>
      </div>
      <Tabs options={SORT_OPTIONS} value={sort} onChange={setSort} size="sm" />
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((brawler) => (
          <BrawlerCard key={brawler.id} brawler={brawler} />
        ))}
      </div>
    </div>
  );
}
