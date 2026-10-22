"use client";

import { useAuth } from "./useAuth";

export function Greeting() {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <p className="text-tg-hint">Загрузка…</p>;
  }

  if (auth.status === "outside") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Brawlmates</h1>
        <p className="text-tg-hint">Открой приложение через бота в Telegram.</p>
      </div>
    );
  }

  if (auth.status === "error") {
    return <p className="text-tg-hint">{auth.message}</p>;
  }

  const since = new Date(auth.user.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Привет, {auth.user.firstName}!</h1>
      <p className="text-tg-hint">В Brawlmates с {since}</p>
    </div>
  );
}
