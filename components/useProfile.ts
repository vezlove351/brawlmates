"use client";

import { useEffect, useState } from "react";
import type { PlayerProfile } from "@/lib/brawlstars";
import { apiPost } from "@/lib/api-client";

export interface ProfileResponse {
  profile: PlayerProfile;
  stale: boolean;
  updatedMinutesAgo: number;
}

export type ProfileState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: ProfileResponse };

// Загружает профиль привязанного игрока. playerTag — чтобы перезагрузить при смене тега.
export function useProfile(playerTag: string): ProfileState {
  const [state, setState] = useState<{ tag: string; value: ProfileState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<ProfileResponse>("/api/profile").then((result) => {
      if (cancelled) return;
      setState({
        tag: playerTag,
        value: result.ok ? { status: "ok", data: result.data } : { status: "error", message: result.error },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [playerTag]);

  // Пока не пришёл ответ для текущего тега — показываем загрузку.
  return state?.tag === playerTag ? state.value : { status: "loading" };
}
