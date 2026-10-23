import { BrawlerIcon } from "./BrawlerIcon";
import { modeName } from "@/lib/modes";

export interface BattleItem {
  battleTime: string;
  mode: string;
  map: string | null;
  result: string | null;
  rank: number | null;
  trophyChange: number | null;
  brawlerId: number | null;
}

// Итог боя: победа/поражение/ничья или место в «Столкновении».
function outcome(b: BattleItem): { label: string; className: string } {
  if (b.result === "victory") return { label: "Победа", className: "bg-green-600 text-white" };
  if (b.result === "defeat") return { label: "Поражение", className: "bg-red-600 text-white" };
  if (b.result === "draw") return { label: "Ничья", className: "bg-gray-500 text-white" };
  if (b.rank !== null) return { label: `${b.rank} место`, className: "bg-amber-500 text-white" };
  return { label: "—", className: "bg-gray-500 text-white" };
}

export function BattleRow({ battle }: { battle: BattleItem }) {
  const { label, className } = outcome(battle);
  const time = new Date(battle.battleTime).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const change = battle.trophyChange;

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-tg-secondary-bg p-2">
      {battle.brawlerId ? (
        <BrawlerIcon id={battle.brawlerId} size={44} className="h-11 w-11 shrink-0 rounded-xl" />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-xl bg-black/10" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{modeName(battle.mode)}</p>
        <p className="truncate text-xs text-tg-hint">
          {battle.map ? `${battle.map} · ` : ""}
          {time}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${className}`}>{label}</span>
        {change !== null && (
          <span
            className={`text-sm font-bold ${
              change > 0 ? "text-green-600" : change < 0 ? "text-red-500" : "text-tg-hint"
            }`}
          >
            {change > 0 ? `+${change}` : change} 🏆
          </span>
        )}
      </div>
    </li>
  );
}
