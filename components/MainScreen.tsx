"use client";

import { useState } from "react";
import { initData, useSignal } from "@telegram-apps/sdk-react";
import { parseProfileStartParam } from "@/lib/links";
import { BottomNav, type Section } from "./BottomNav";
import { Greeting } from "./Greeting";
import { LfgScreen } from "./LfgScreen";
import { LinkAccount } from "./LinkAccount";
import { PlayerView } from "./PlayerView";
import { PublicProfile } from "./PublicProfile";
import { useAuth } from "./useAuth";

export function MainScreen() {
  const { auth, updateUser } = useAuth();
  // Если приложение открыли по ссылке на чужой профиль (startapp=p_ТЕГ).
  const sharedTag = parseProfileStartParam(useSignal(initData.startParam));
  const [showOwn, setShowOwn] = useState(false);
  const [section, setSection] = useState<Section>("profile");

  if (auth.status === "loading") {
    return <Centered><p className="text-tg-hint">Загрузка…</p></Centered>;
  }

  if (auth.status === "outside") {
    return (
      <Centered>
        <h1 className="text-2xl font-bold">Brawlmates</h1>
        <p className="text-tg-hint">Открой приложение через бота в Telegram.</p>
      </Centered>
    );
  }

  if (auth.status === "error") {
    return <Centered><p className="text-tg-hint">{auth.message}</p></Centered>;
  }

  // Ссылка на свой же профиль — просто показываем обычный режим.
  if (sharedTag && sharedTag !== auth.user.playerTag && !showOwn) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
        <PublicProfile playerTag={sharedTag} onOpenOwn={() => setShowOwn(true)} />
      </div>
    );
  }

  const playerTag = auth.user.playerTag;

  // Пока тег не привязан — только привязка, разделов ещё нет.
  if (!playerTag) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
        <Greeting firstName={auth.user.firstName} createdAt={auth.user.createdAt} />
        <LinkAccount onLinked={(tag) => updateUser({ playerTag: tag })} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      {section === "profile" ? (
        <>
          <Greeting firstName={auth.user.firstName} createdAt={auth.user.createdAt} />
          <PlayerView playerTag={playerTag} />
        </>
      ) : (
        <LfgScreen playerTag={playerTag} />
      )}
      <BottomNav value={section} onChange={setSection} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      {children}
    </div>
  );
}
