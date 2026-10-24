"use client";

import { useState, type ReactNode } from "react";
import { apiPost } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import type { TipCard } from "@/lib/tips";
import { BrawlerIcon } from "./BrawlerIcon";

// Карточка совета. actions — дополнительные кнопки снизу (жалоба и т. п.).
export function TipCardView({ tip, actions }: { tip: TipCard; actions?: ReactNode }) {
  const [useful, setUseful] = useState({ count: tip.usefulCount, voted: tip.votedByMe });
  const [error, setError] = useState<string | null>(null);

  async function markUseful() {
    setError(null);
    const result = await apiPost<{ usefulCount: number }>("/api/tips/useful", { tipId: tip.id });
    if (result.ok) setUseful({ count: result.data.usefulCount, voted: true });
    else setError(result.error);
  }

  const items = [
    tip.gadget && `🔧 ${tip.gadget}`,
    tip.starPower && `⭐ ${tip.starPower}`,
    tip.gear && `⚙️ ${tip.gear}`,
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <header className="flex items-center gap-3">
        <BrawlerIcon id={tip.brawlerId} name={tip.brawlerName} size={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{tip.brawlerName}</p>
          <p className="truncate text-xs text-tg-hint">
            {tip.modeLabel ? `${tip.modeLabel}${tip.map ? ` · ${tip.map}` : ""}` : "Любой режим"}
          </p>
        </div>
        {tip.status === "pending" && (
          <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">⏳ На проверке</span>
        )}
      </header>

      {items.length > 0 && <p className="text-xs font-semibold text-tg-hint">{items.join(" · ")}</p>}

      <p className="text-sm leading-relaxed">{tip.text}</p>

      <footer className="flex items-center justify-between gap-2 border-t border-tg-hint/15 pt-2">
        <span className="min-w-0 text-xs text-tg-hint">
          <span className="font-semibold text-tg-text">{tip.author.name}</span>
          {tip.author.brawlerTrophies !== null && (
            <> · 🏆 {formatNumber(tip.author.brawlerTrophies)} на {tip.brawlerName}</>
          )}
        </span>
        {tip.isMine || tip.status !== "published" ? (
          <span className="shrink-0 text-xs text-tg-hint">👍 {useful.count}</span>
        ) : (
          <button
            onClick={markUseful}
            disabled={useful.voted}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              useful.voted ? "bg-tg-button text-tg-button-text" : "bg-tg-bg text-tg-text"
            }`}
          >
            👍 Полезно · {useful.count}
          </button>
        )}
      </footer>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {actions}
    </article>
  );
}
