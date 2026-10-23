"use client";

import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { bracketLabel, findLanguage, findMode } from "@/lib/lfg";
import type { PublicLfgPost } from "@/lib/lfg-server";
import { BrawlerIcon } from "./BrawlerIcon";
import { formatTimeLeft, useNow } from "./useNow";

// Карточка заявки «ищу тиммейта». Кнопки действий передаются снаружи (children).
export function LfgPostCard({ post, children }: { post: PublicLfgPost; children?: ReactNode }) {
  const now = useNow();
  const mode = findMode(post.mode);
  const language = findLanguage(post.language);
  const timeLeft = now === null ? null : new Date(post.expiresAt).getTime() - now;

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{post.playerName}</p>
          <p className="text-sm text-tg-hint">🏆 {formatNumber(post.authorTrophies)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-tg-bg px-2 py-1 text-xs font-semibold text-tg-hint">
          ⏳ {formatTimeLeft(timeLeft)}
        </span>
      </header>

      <p className="text-lg font-bold">
        {mode?.emoji} {mode?.label ?? post.mode}
      </p>

      <div className="flex items-center gap-2">
        {post.brawlerIds.map((id) => (
          <BrawlerIcon key={id} id={id} size={44} className="h-11 w-11 rounded-lg" />
        ))}
      </div>

      <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
        <Tag>👥 Нужно: {post.playersNeeded}</Tag>
        <Tag>🏆 {bracketLabel(post.trophiesMin, post.trophiesMax)}</Tag>
        <Tag>{language?.label ?? post.language}</Tag>
      </ul>

      {post.comment && <p className="rounded-xl bg-tg-bg px-3 py-2 text-sm">💬 {post.comment}</p>}

      {children}
    </article>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <li className="rounded-full bg-tg-bg px-2.5 py-1">{children}</li>;
}
