import { brawlerIconUrl, type PlayerBrawler } from "@/lib/brawlstars";
import { formatNumber } from "@/lib/format";

export function BrawlerCard({ brawler }: { brawler: PlayerBrawler }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-tg-secondary-bg p-2">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- картинки с CDN Brawlify, их много и они маленькие */}
        <img
          src={brawlerIconUrl(brawler.id)}
          alt={brawler.name}
          width={200}
          height={200}
          loading="lazy"
          className="aspect-square w-full rounded-xl bg-black/10"
        />
        {/* Сила — как в игре, кружок в углу */}
        <span
          className="absolute -bottom-1 -left-1 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-fuchsia-600 px-1 text-xs font-black text-white"
          title="Сила"
        >
          {brawler.power}
        </span>
      </div>
      {/* API присылает имена капсом: "EL PRIMO" → "El Primo" */}
      <p className="mt-1 truncate text-sm font-bold capitalize">{brawler.name.toLowerCase()}</p>
      <p className="text-sm font-semibold">🏆 {formatNumber(brawler.trophies)}</p>
      <p className="text-xs text-tg-hint">Ранг {brawler.rank}</p>
    </div>
  );
}
