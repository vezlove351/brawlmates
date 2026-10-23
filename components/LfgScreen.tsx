"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { PublicLfgPost } from "@/lib/lfg-server";
import { LfgForm } from "./LfgForm";
import { LfgPostCard } from "./LfgPostCard";
import { useProfile } from "./useProfile";

interface MyLfgState {
  activePost: PublicLfgPost | null;
  postsLeftToday: number;
}

// Раздел «Тиммейты»: моя заявка или форма создания.
export function LfgScreen({ playerTag }: { playerTag: string }) {
  const profile = useProfile(playerTag, "own");
  const [mine, setMine] = useState<MyLfgState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<MyLfgState>("/api/lfg/me").then((result) => {
      if (cancelled) return;
      if (result.ok) setMine(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Note>{error}</Note>;
  if (!mine || profile.status === "loading") {
    return <div className="h-96 animate-pulse rounded-2xl bg-tg-secondary-bg" />;
  }
  if (profile.status === "error") return <Note>{profile.message}</Note>;

  if (mine.activePost) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Моя заявка</h2>
        <LfgPostCard post={mine.activePost} />
        <p className="text-center text-xs text-tg-hint">
          Когда кто-то нажмёт «Я в деле», бот пришлёт тебе сообщение.
        </p>
      </div>
    );
  }

  return (
    <LfgForm
      profile={profile.data.profile}
      postsLeftToday={mine.postsLeftToday}
      onCreated={(post) =>
        setMine((m) => ({ activePost: post, postsLeftToday: Math.max(0, (m?.postsLeftToday ?? 1) - 1) }))
      }
    />
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
