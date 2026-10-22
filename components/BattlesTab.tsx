"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { BattleRow, type BattleItem } from "./BattleRow";
import { TrophyChart, type TrophyPoint } from "./TrophyChart";

interface BattlesResponse {
  battles: BattleItem[];
  history: TrophyPoint[];
  trackingSince: string | null;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: BattlesResponse };

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

export function BattlesTab() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiPost<BattlesResponse>("/api/battles").then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "ok", data: result.data } : { status: "error", message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <div className="h-96 animate-pulse rounded-3xl bg-tg-secondary-bg" />;
  }
  if (state.status === "error") {
    return <Note>{state.message}</Note>;
  }

  const { battles, history, trackingSince } = state.data;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Трофеи по дням</h2>
        {history.length >= 2 ? (
          <TrophyChart points={history} />
        ) : (
          <Note>
            {trackingSince
              ? `Мы начали следить за твоими трофеями ${formatDay(trackingSince)}. График появится, когда наберётся хотя бы 2 дня — загляни завтра!`
              : "Мы ещё не успели сохранить твои трофеи. Загляни через полчаса."}
          </Note>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Последние бои</h2>
        {battles.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {battles.map((battle) => (
              <BattleRow key={battle.battleTime} battle={battle} />
            ))}
          </ul>
        ) : (
          <Note>
            Боёв пока нет. Мы сохраняем новые бои каждые 30 минут — сыграй пару матчей и загляни
            позже.
          </Note>
        )}
        {trackingSince && battles.length > 0 && (
          <p className="text-center text-xs text-tg-hint">
            Сохраняем бои с {formatDay(trackingSince)}. Brawl Stars хранит только 25 последних
            боёв, поэтому более ранних у нас нет.
          </p>
        )}
      </section>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
