"use client";

import { useEffect, useState } from "react";
import { initData, useSignal } from "@telegram-apps/sdk-react";
import { apiPost } from "@/lib/api-client";
import { countryFromLanguage, countryName, RANKING_COUNTRIES } from "@/lib/countries";
import type { RankingEntry } from "@/lib/db/schema";
import { formatNumber } from "@/lib/format";
import { PlayerAvatar } from "./PlayerAvatar";
import { Tabs } from "./Tabs";

type Scope = "global" | "country" | "brawlmates";

interface RankingRow extends RankingEntry {
  inBrawlmates?: boolean;
}

interface RankingData {
  entries: RankingRow[];
  me: RankingEntry | null;
  myTag: string | null;
  total?: number;
  updatedMinutesAgo?: number;
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: "global", label: "🌍 Мир" },
  { value: "country", label: "🏳️ Страна" },
  { value: "brawlmates", label: "Brawlmates" },
];

// Рейтинг: мировой, по стране и среди игроков Brawlmates.
export function LeaderboardScreen({ onOpenProfile }: { onOpenProfile: (tag: string) => void }) {
  const user = useSignal(initData.user);
  const [scope, setScope] = useState<Scope>("brawlmates");
  const [chosenCountry, setCountry] = useState<string | null>(null);
  // Страна по умолчанию — по языку Telegram.
  const country = chosenCountry ?? countryFromLanguage(user?.language_code);
  const [data, setData] = useState<{ key: string; value: RankingData | string } | null>(null);

  const key = scope === "country" ? `country:${country}` : scope;
  useEffect(() => {
    let cancelled = false;
    apiPost<RankingData>("/api/rankings", { scope, country }).then((result) => {
      if (!cancelled) setData({ key, value: result.ok ? result.data : result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [key, scope, country]);

  const current = data?.key === key ? data.value : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Рейтинг</h1>
      <Tabs options={SCOPES} value={scope} onChange={setScope} size="sm" />

      {scope === "country" && (
        <select
          aria-label="Страна"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-xl bg-tg-secondary-bg px-3 py-2.5 font-semibold outline-none"
        >
          {RANKING_COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      )}

      {current === null ? (
        <div className="h-96 animate-pulse rounded-2xl bg-tg-secondary-bg" />
      ) : typeof current === "string" ? (
        <Note>{current}</Note>
      ) : (
        <RankingList data={current} scope={scope} onOpenProfile={onOpenProfile} />
      )}
    </div>
  );
}

function RankingList({
  data,
  scope,
  onOpenProfile,
}: {
  data: RankingData;
  scope: Scope;
  onOpenProfile: (tag: string) => void;
}) {
  const meInList = data.me && data.entries.some((e) => e.tag === data.me!.tag);

  return (
    <div className="flex flex-col gap-2">
      {/* Своё место — всегда сверху, даже если ты не в топе */}
      {scope === "brawlmates" && data.me && (
        <div className="rounded-2xl bg-tg-button px-4 py-3 text-tg-button-text">
          <p className="text-sm opacity-90">Ты в Brawlmates</p>
          <p className="text-lg font-black">
            {data.me.rank} место из {data.total}
          </p>
        </div>
      )}
      {scope !== "brawlmates" && data.me && (
        <p className="rounded-2xl bg-tg-button px-4 py-3 text-center font-bold text-tg-button-text">
          🎉 Ты в этом рейтинге на {data.me.rank} месте!
        </p>
      )}

      {data.entries.length === 0 ? (
        <Note>
          {scope === "brawlmates"
            ? "Пока здесь никого нет. Позови друзей в Brawlmates!"
            : "В этом рейтинге пока пусто."}
        </Note>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {data.entries.map((e) => {
            const isMe = e.tag === data.myTag;
            const clickable = scope === "brawlmates" || e.inBrawlmates;
            return (
              <li key={e.tag}>
                <button
                  disabled={!clickable || isMe}
                  onClick={() => onOpenProfile(e.tag)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ${
                    isMe ? "bg-tg-button/20 ring-2 ring-tg-button" : "bg-tg-secondary-bg"
                  }`}
                >
                  <span className={`w-9 shrink-0 text-center font-black ${e.rank <= 3 ? "text-lg" : "text-sm text-tg-hint"}`}>
                    {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : e.rank}
                  </span>
                  <PlayerAvatar iconId={e.iconId} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {e.name}
                      {isMe && " (ты)"}
                      {!isMe && scope !== "brawlmates" && e.inBrawlmates && " · в Brawlmates"}
                    </span>
                    {e.club && <span className="block truncate text-xs text-tg-hint">🛡️ {e.club}</span>}
                  </span>
                  <span className="shrink-0 text-sm font-bold">🏆 {formatNumber(e.trophies)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {scope === "brawlmates" && data.me && !meInList && (
        <p className="text-center text-xs text-tg-hint">Показан топ-100</p>
      )}
      {data.updatedMinutesAgo !== undefined && (
        <p className="text-center text-xs text-tg-hint">
          Топ-200 по данным Brawl Stars · обновлено{" "}
          {data.updatedMinutesAgo < 1 ? "только что" : `${data.updatedMinutesAgo} мин назад`}
        </p>
      )}
      {scope === "brawlmates" && (
        <p className="text-center text-xs text-tg-hint">Трофеи обновляются каждые 30 минут</p>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
