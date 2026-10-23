"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { FeedPost, PublicLfgPost } from "@/lib/lfg-server";
import { Button } from "./Button";
import { FeedPostActions } from "./FeedPostActions";
import { LfgFilters, type LfgFilterValues } from "./LfgFilters";
import { LfgForm } from "./LfgForm";
import { LfgPostCard } from "./LfgPostCard";
import { useProfile } from "./useProfile";

interface MyLfgState {
  activePost: PublicLfgPost | null;
  postsLeftToday: number;
}

// Раздел «Тиммейты»: моя заявка сверху, затем лента чужих заявок с фильтрами.
export function LfgScreen({
  playerTag,
  onOpenProfile,
}: {
  playerTag: string;
  onOpenProfile: (tag: string) => void;
}) {
  const profile = useProfile(playerTag, "own");
  const [mine, setMine] = useState<MyLfgState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<LfgFilterValues>({
    mode: "",
    bracket: "any",
    language: "",
    friendsOnly: false,
  });
  const [feed, setFeed] = useState<{ key: string; posts: FeedPost[] } | null>(null);
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

  // Лента перезагружается при смене фильтров.
  const feedKey = JSON.stringify(filters);
  useEffect(() => {
    let cancelled = false;
    apiPost<{ posts: FeedPost[] }>("/api/lfg/feed", JSON.parse(feedKey)).then((result) => {
      if (cancelled) return;
      if (result.ok) setFeed({ key: feedKey, posts: result.data.posts });
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [feedKey]);

  async function closeMyPost(postId: number) {
    const result = await apiPost("/api/lfg/close", { postId });
    if (result.ok) setMine((m) => (m ? { ...m, activePost: null } : m));
    else setError(result.error);
  }

  // Скрыли игрока — убираем из ленты все его заявки.
  function removeAuthor(tag: string) {
    setFeed((f) => (f ? { ...f, posts: f.posts.filter((p) => p.playerTag !== tag) } : f));
  }

  if (error) return <Note>{error}</Note>;

  return (
    <div className="flex flex-col gap-4">
      {/* Моя заявка или кнопка/форма создания */}
      {!mine || profile.status === "loading" ? (
        <div className="h-24 animate-pulse rounded-2xl bg-tg-secondary-bg" />
      ) : mine.activePost ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Моя заявка</h2>
          <LfgPostCard post={mine.activePost}>
            <Button variant="secondary" className="bg-tg-bg! py-2 text-sm" onClick={() => closeMyPost(mine.activePost!.id)}>
              Закрыть заявку
            </Button>
          </LfgPostCard>
          <p className="text-center text-xs text-tg-hint">
            Когда кто-то нажмёт «Я в деле», бот пришлёт тебе сообщение.
          </p>
        </section>
      ) : showForm && profile.status === "ok" ? (
        <div className="flex flex-col gap-1">
          <LfgForm
            profile={profile.data.profile}
            postsLeftToday={mine.postsLeftToday}
            onCreated={(post) => {
              setShowForm(false);
              setMine((m) => ({ activePost: post, postsLeftToday: Math.max(0, (m?.postsLeftToday ?? 1) - 1) }));
            }}
          />
          <Button variant="secondary" onClick={() => setShowForm(false)}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button onClick={() => setShowForm(true)} disabled={profile.status !== "ok"}>
          ➕ Создать заявку
        </Button>
      )}

      {/* Лента */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Ищут тиммейтов</h2>
        <LfgFilters value={filters} onChange={setFilters} />

        {!feed || feed.key !== feedKey ? (
          <div className="h-48 animate-pulse rounded-2xl bg-tg-secondary-bg" />
        ) : feed.posts.length === 0 ? (
          <Note>
            {filters.friendsOnly
              ? "Сейчас никто из друзей не ищет тиммейта. Создай свою заявку — друзья её увидят!"
              : "Сейчас никто не ищет тиммейта с такими фильтрами. Создай свою заявку — тебя найдут!"}
          </Note>
        ) : (
          feed.posts.map((post) => (
            <LfgPostCard key={post.id} post={post} onOpenProfile={onOpenProfile}>
              <FeedPostActions post={post} onHidden={() => removeAuthor(post.playerTag)} />
            </LfgPostCard>
          ))
        )}
      </section>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
