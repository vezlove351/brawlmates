"use client";

import { initData, useSignal } from "@telegram-apps/sdk-react";
import { useTelegramStatus } from "./TelegramProvider";

export function Greeting() {
  const status = useTelegramStatus();
  const user = useSignal(initData.user);

  if (status === "loading") {
    return <p className="text-tg-hint">Загрузка…</p>;
  }

  if (status === "outside") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Brawlmates</h1>
        <p className="text-tg-hint">Открой приложение через бота в Telegram.</p>
      </div>
    );
  }

  return (
    <h1 className="text-2xl font-bold">Привет, {user?.first_name ?? "игрок"}!</h1>
  );
}
