"use client";

import { useEffect, useState } from "react";
import { initData, useSignal } from "@telegram-apps/sdk-react";
import { useTelegramStatus } from "./TelegramProvider";

export interface AuthUser {
  firstName: string;
  createdAt: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "outside" }
  | { status: "error"; message: string }
  | { status: "ok"; user: AuthUser };

// Отправляет initData на сервер. Имя берём из ответа сервера,
// а не из клиента, — сервер проверил подпись.
export function useAuth(): AuthState {
  const telegram = useTelegramStatus();
  const raw = useSignal(initData.raw);
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    if (telegram !== "ready" || !raw) return;

    let cancelled = false;
    fetch("/api/auth", { method: "POST", headers: { authorization: `tma ${raw}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error("Не удалось войти через Telegram. Закрой и открой приложение снова.");
        const data = (await res.json()) as { user: AuthUser };
        if (!cancelled) setState({ status: "ok", user: data.user });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Ошибка сети";
        if (!cancelled) setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [telegram, raw]);

  if (telegram === "outside") return { status: "outside" };
  return state;
}
