interface StatTileProps {
  label: string;
  value: string;
  emoji: string;
}

// Плитка со статистикой на карточке игрока.
export function StatTile({ label, value, emoji }: StatTileProps) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
      <p className="text-xs font-semibold text-white/80">
        {emoji} {label}
      </p>
      <p className="truncate text-xl font-black">{value}</p>
    </div>
  );
}
