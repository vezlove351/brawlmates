"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import type { PlayerCard } from "@/lib/friends-server";
import { Button } from "./Button";
import { PlayerAvatar } from "./PlayerAvatar";
import { formatAgo, useNow } from "./useNow";

interface FriendsData {
  incoming: PlayerCard[];
  friends: PlayerCard[];
}

// Экран «Друзья»: входящие заявки сверху, дальше список друзей.
export function FriendsScreen({ onOpenProfile }: { onOpenProfile: (tag: string) => void }) {
  const [data, setData] = useState<FriendsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    apiPost<FriendsData>("/api/friends").then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function answer(player: PlayerCard, accept: boolean) {
    setBusyTag(player.tag);
    const result = await apiPost("/api/friends/answer", { tag: player.tag, accept });
    setBusyTag(null);
    if (!result.ok) return setError(result.error);
    setData((d) =>
      d
        ? {
            incoming: d.incoming.filter((p) => p.tag !== player.tag),
            friends: accept ? [player, ...d.friends] : d.friends,
          }
        : d,
    );
  }

  if (error) return <Note>{error}</Note>;
  if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-tg-secondary-bg" />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Друзья</h1>

      {data.incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-tg-hint">Заявки в друзья · {data.incoming.length}</h2>
          {data.incoming.map((p) => (
            <div key={p.tag} className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-3">
              <PlayerRow player={p} onClick={() => onOpenProfile(p.tag)} />
              <div className="grid grid-cols-2 gap-2">
                <Button className="py-2 text-sm" disabled={busyTag === p.tag} onClick={() => answer(p, true)}>
                  Принять
                </Button>
                <Button
                  variant="secondary"
                  className="bg-tg-bg! py-2 text-sm"
                  disabled={busyTag === p.tag}
                  onClick={() => answer(p, false)}
                >
                  Отклонить
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        {data.incoming.length > 0 && <h2 className="font-semibold text-tg-hint">Мои друзья</h2>}
        {data.friends.length === 0 ? (
          <Note>
            Друзей пока нет. Открой профиль игрока — по ссылке или из ленты «Тиммейты» (нажми на
            ник) — и нажми «Добавить в друзья».
          </Note>
        ) : (
          data.friends.map((p) => (
            <div key={p.tag} className="rounded-2xl bg-tg-secondary-bg p-3">
              <PlayerRow
                player={p}
                onClick={() => onOpenProfile(p.tag)}
                extra={
                  p.lastBattleAt
                    ? `последний бой ${formatAgo(now === null ? null : now - new Date(p.lastBattleAt).getTime())}`
                    : "боёв пока не видели"
                }
              />
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function PlayerRow({ player, onClick, extra }: { player: PlayerCard; onClick: () => void; extra?: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 text-left">
      <PlayerAvatar iconId={player.iconId} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{player.name}</span>
        <span className="block text-sm text-tg-hint">
          {player.trophies !== null ? `🏆 ${formatNumber(player.trophies)}` : player.tag}
          {extra && ` · ${extra}`}
        </span>
      </span>
      <span className="text-tg-hint">›</span>
    </button>
  );
}


function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
