"use client";

import { useState } from "react";
import { BattlesTab } from "./BattlesTab";
import { BrawlerList } from "./BrawlerList";
import { ProfileCard } from "./ProfileCard";
import { Tabs } from "./Tabs";
import { useProfile } from "./useProfile";

type Tab = "profile" | "brawlers" | "battles";

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Профиль" },
  { value: "brawlers", label: "Бравлеры" },
  { value: "battles", label: "Бои" },
];

// Всё про привязанного игрока: вкладки «Профиль», «Бравлеры» и «Бои».
// Профиль загружается один раз и общий для первых двух вкладок.
export function PlayerView({ playerTag }: { playerTag: string }) {
  const state = useProfile(playerTag);
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="flex flex-col gap-4">
      <Tabs options={TAB_OPTIONS} value={tab} onChange={setTab} />

      {tab === "battles" ? (
        <BattlesTab />
      ) : (
        <>
          {state.status === "loading" && (
            <div className="h-96 animate-pulse rounded-3xl bg-tg-secondary-bg" />
          )}

          {state.status === "error" && (
            <div className="rounded-3xl bg-tg-secondary-bg p-5 text-center text-tg-hint">
              {state.message}
            </div>
          )}

          {state.status === "ok" && (
            <>
              {tab === "profile" ? (
                <ProfileCard profile={state.data.profile} />
              ) : (
                <BrawlerList brawlers={state.data.profile.brawlers} />
              )}
              <p className="text-center text-xs text-tg-hint">
                {state.data.stale
                  ? "Brawl Stars сейчас недоступен — показаны последние сохранённые данные"
                  : state.data.updatedMinutesAgo < 1
                    ? "Данные только что обновлены"
                    : `Данные обновлены ${state.data.updatedMinutesAgo} мин назад`}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
