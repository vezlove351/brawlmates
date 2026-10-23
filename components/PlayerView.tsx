"use client";

import { useState, type ReactNode } from "react";
import { BattlesTab } from "./BattlesTab";
import { BrawlerList } from "./BrawlerList";
import { ProfileCard } from "./ProfileCard";
import { ShareButton } from "./ShareButton";
import { Tabs } from "./Tabs";
import { useProfile, type ProfileState } from "./useProfile";

type Tab = "profile" | "brawlers" | "battles";

const OWN_TABS: { value: Tab; label: string }[] = [
  { value: "profile", label: "Профиль" },
  { value: "brawlers", label: "Бравлеры" },
  { value: "battles", label: "Бои" },
];

// В чужом профиле истории боёв нет — только карточка и бравлеры.
const PUBLIC_TABS = OWN_TABS.filter((t) => t.value !== "battles");

interface PlayerViewProps {
  playerTag: string;
  // true — чужой профиль по ссылке, только просмотр.
  readonly?: boolean;
  // Что показать, если чужой профиль не найден в Brawlmates.
  renderNotFound?: (message: string) => ReactNode;
}

// Профиль игрока с вкладками. Данные профиля загружаются один раз на все вкладки.
export function PlayerView({ playerTag, readonly = false, renderNotFound }: PlayerViewProps) {
  const state = useProfile(playerTag, readonly ? "public" : "own");
  const [tab, setTab] = useState<Tab>("profile");

  if (state.status === "error" && state.notFound && renderNotFound) {
    return renderNotFound(state.message);
  }

  // Друг видит и вкладку «Бои» (право проверяет сервер, тут — только показ).
  const isFriend = readonly && state.status === "ok" && state.data.full === true;
  const tabs = !readonly || isFriend ? OWN_TABS : PUBLIC_TABS;

  return (
    <div className="flex flex-col gap-4">
      {isFriend && <p className="-mb-2 text-xs text-tg-hint">👥 Вы друзья — тебе виден полный профиль</p>}
      <Tabs options={tabs} value={tab} onChange={setTab} />
      {tab === "battles" && (!readonly || isFriend) ? (
        <BattlesTab playerTag={readonly ? playerTag : undefined} />
      ) : (
        <ProfileTabs tab={tab} state={state} readonly={readonly} />
      )}
    </div>
  );
}

function ProfileTabs({ tab, state, readonly }: { tab: Tab; state: ProfileState; readonly: boolean }) {
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
    <>
      {tab === "brawlers" ? (
        <BrawlerList brawlers={profile.brawlers} />
      ) : (
        <>
          <ProfileCard profile={profile} />
          {/* Делиться можно только своим профилем */}
          {!readonly && <ShareButton playerTag={profile.tag} />}
        </>
      )}
      <p className="text-center text-xs text-tg-hint">
        {stale
          ? "Brawl Stars сейчас недоступен — показаны последние сохранённые данные"
          : updatedMinutesAgo < 1
            ? "Данные только что обновлены"
            : `Данные обновлены ${updatedMinutesAgo} мин назад`}
      </p>
    </>
  );
}
