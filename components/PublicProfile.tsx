"use client";

import { Button } from "./Button";
import { PlayerView } from "./PlayerView";

interface PublicProfileProps {
  playerTag: string;
  onOpenOwn: () => void;
}

// Чужой профиль, открытый по ссылке. Только просмотр.
export function PublicProfile({ playerTag, onOpenOwn }: PublicProfileProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-tg-hint">Профиль игрока</p>
          <h1 className="text-xl font-bold">{playerTag}</h1>
        </div>
        <button onClick={onOpenOwn} className="shrink-0 text-sm font-semibold text-tg-link">
          Мой профиль →
        </button>
      </div>

      <PlayerView
        playerTag={playerTag}
        readonly
        renderNotFound={(message) => (
          <div className="flex flex-col gap-4 rounded-2xl bg-tg-secondary-bg p-5 text-center">
            <p className="text-4xl">🤷</p>
            <p className="font-semibold">{message}</p>
            <p className="text-sm text-tg-hint">
              Здесь можно смотреть профили только тех, кто сам привязал свой аккаунт в Brawlmates.
              Позови друга — пусть откроет бота и привяжет тег!
            </p>
            <Button onClick={onOpenOwn}>Открыть мой профиль</Button>
          </div>
        )}
      />
    </div>
  );
}
