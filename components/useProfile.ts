"use client";

import { useEffect, useState } from "react";
import type { PlayerProfile } from "@/lib/brawlstars";
import { apiPost } from "@/lib/api-client";

export interface ProfileResponse {
  profile: PlayerProfile;
  stale: boolean;
  updatedMinutesAgo: number;
  // Для чужого профиля: true — мы друзья, виден полный профиль (с боями).
  full?: boolean;
}

export type ProfileState =
  | { status: "loading" }
  | { status: "error"; message: string; notFound: boolean }
  | { status: "ok"; data: ProfileResponse };

// Загружает профиль: свой ("own") или чужой по ссылке ("public").
export function useProfile(playerTag: string, source: "own" | "public"): ProfileState {
  const key = `${source}:${playerTag}`;
  const [state, setState] = useState<{ key: string; value: ProfileState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const request =
      source === "own"
        ? apiPost<ProfileResponse>("/api/profile")
        : apiPost<ProfileResponse>("/api/public-profile", { tag: playerTag });

    request.then((result) => {
      if (cancelled) return;
      setState({
        key,
        value: result.ok
          ? { status: "ok", data: result.data }
          : { status: "error", message: result.error, notFound: result.status === 404 },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key, playerTag, source]);

  // Пока не пришёл ответ для текущего игрока — показываем загрузку.
  return state?.key === key ? state.value : { status: "loading" };
}
