"use client";

import { useCallback, useEffect, useState } from "react";
import { initData, useSignal } from "@telegram-apps/sdk-react";
import { apiPost } from "@/lib/api-client";
import { useTelegramStatus } from "./TelegramProvider";

export interface AuthUser {
  firstName: string;
  createdAt: string;
  playerTag: string | null;
}

export type AuthState =
  | { status: "loading" }
  | { status: "outside" }
  | { status: "error"; message: string }
  | { status: "ok"; user: AuthUser };

// Входит через сервер. Данные пользователя берём из ответа сервера,
// а не из клиента, — сервер проверил подпись.
export function useAuth(): { auth: AuthState; updateUser: (patch: Partial<AuthUser>) => void } {
  const telegram = useTelegramStatus();
  const raw = useSignal(initData.raw);
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    if (telegram !== "ready" || !raw) return;

    let cancelled = false;
    apiPost<{ user: AuthUser }>("/api/auth").then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ok", user: result.data.user }
          : { status: "error", message: "Не удалось войти через Telegram. Закрой и открой приложение снова." },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [telegram, raw]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setState((prev) => (prev.status === "ok" ? { ...prev, user: { ...prev.user, ...patch } } : prev));
  }, []);

  const auth: AuthState = telegram === "outside" ? { status: "outside" } : state;
  return { auth, updateUser };
}
