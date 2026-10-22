"use client";

import { useState } from "react";
import { iconUrl, remoteIconUrl, type PlayerProfile } from "@/lib/brawlstars";
import { StatTile } from "./StatTile";
import { useProfile } from "./useProfile";

const formatNumber = (n: number) => n.toLocaleString("ru-RU");

export function ProfileSection({ playerTag }: { playerTag: string }) {
  const state = useProfile(playerTag);

  if (state.status === "loading") {
    return <div className="h-96 animate-pulse rounded-3xl bg-tg-secondary-bg" />;
  }
  if (state.status === "error") {
    return (
      <div className="rounded-3xl bg-tg-secondary-bg p-5 text-center text-tg-hint">
        {state.message}
      </div>
    );
  }

  const { profile, stale, updatedMinutesAgo } = state.data;
  return (
    <div className="flex flex-col gap-2">
      <ProfileCard profile={profile} />
      <p className="text-center text-xs text-tg-hint">
        {stale
          ? "Brawl Stars сейчас недоступен — показаны последние сохранённые данные"
          : updatedMinutesAgo < 1
            ? "Данные только что обновлены"
            : `Данные обновлены ${updatedMinutesAgo} мин назад`}
      </p>
    </div>
  );
}

// Карточка игрока: яркая и одинаковая в светлой и тёмной теме, чтобы её хотелось показать.
export function ProfileCard({ profile }: { profile: PlayerProfile }) {
  return (
    <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-700 p-5 text-white shadow-xl">
      {/* Декоративные круги на фоне */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-black/10" />

      <header className="relative flex items-center gap-4">
        <PlayerIcon iconId={profile.iconId} />
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-black drop-shadow-sm">{profile.name}</h2>
          <p className="text-sm font-medium text-white/80">{profile.tag}</p>
        </div>
      </header>

      <div className="relative my-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Трофеи</p>
        <p className="flex items-center justify-center gap-2 whitespace-nowrap font-black leading-tight drop-shadow-md">
          <span className="text-4xl">🏆</span>
          <span className="text-5xl min-[380px]:text-6xl">{formatNumber(profile.trophies)}</span>
        </p>
        <p className="mt-1 inline-block rounded-full bg-black/20 px-3 py-1 text-sm font-semibold">
          Рекорд: {formatNumber(profile.highestTrophies)}
        </p>
      </div>

      <div className="relative grid grid-cols-2 gap-2">
        <StatTile label="Уровень" value={formatNumber(profile.expLevel)} emoji="⭐" />
        <StatTile label="Клуб" value={profile.club?.name ?? "Без клуба"} emoji="🛡️" />
        <StatTile label="Победы 3 на 3" value={formatNumber(profile.victories3v3)} emoji="⚔️" />
        <StatTile label="Победы соло" value={formatNumber(profile.victoriesSolo)} emoji="💀" />
      </div>
    </article>
  );
}

function PlayerIcon({ iconId }: { iconId: number }) {
  // Если картинку с CDN загрузить не удалось — показываем базовую иконку.
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- маленькая картинка с внешнего CDN, оптимизация не нужна
    <img
      src={failed ? iconUrl(28000000) : remoteIconUrl(iconId)}
      onError={() => setFailed(true)}
      alt=""
      width={72}
      height={72}
      className="h-18 w-18 shrink-0 rounded-2xl border-2 border-white/70 shadow-md"
    />
  );
}
