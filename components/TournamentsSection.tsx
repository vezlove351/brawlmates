"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { LeaderboardScreen } from "./LeaderboardScreen";
import { Tabs } from "./Tabs";
import { TournamentPage } from "./TournamentPage";
import { formatCountdown, useNow } from "./useNow";

export interface TournamentCardData {
  id: number;
  title: string;
  startsAt: string;
  status: "draft" | "registration" | "live" | "finished" | "cancelled";
  maxPlayers: number;
  participants: number;
  joined: boolean;
  map: string | null;
  rounds: number;
}

type Tab = "tournaments" | "rating";

// Раздел «Турниры»: вкладки «Турниры» и «Рейтинг».
export function TournamentsSection({
  initialTournamentId,
  onOpenProfile,
}: {
  initialTournamentId: number | null; // открыли по ссылке t_<id>
  onOpenProfile: (tag: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("tournaments");
  const [openId, setOpenId] = useState<number | null>(initialTournamentId);

  if (openId !== null) {
    return <TournamentPage id={openId} onBack={() => setOpenId(null)} onOpenProfile={onOpenProfile} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        options={[
          { value: "tournaments", label: "🏆 Турниры" },
          { value: "rating", label: "📊 Рейтинг" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "tournaments" ? <TournamentsList onOpen={setOpenId} /> : <LeaderboardScreen onOpenProfile={onOpenProfile} />}
    </div>
  );
}

function TournamentsList({ onOpen }: { onOpen: (id: number) => void }) {
  const [data, setData] = useState<{ upcoming: TournamentCardData[]; past: TournamentCardData[] } | string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<{ upcoming: TournamentCardData[]; past: TournamentCardData[] }>("/api/tournaments").then((result) => {
      if (!cancelled) setData(result.ok ? result.data : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === null) return <div className="h-48 animate-pulse rounded-2xl bg-tg-secondary-bg" />;
  if (typeof data === "string") return <Note>{data}</Note>;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tg-hint">Ближайшие</h2>
        {data.upcoming.length === 0 ? (
          <Note>Ближайших турниров пока нет. Подпишись на канал @brawlmate_app — там анонсы!</Note>
        ) : (
          data.upcoming.map((t) => <TournamentCard key={t.id} t={t} onOpen={onOpen} />)
        )}
      </section>
      {data.past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-tg-hint">Прошедшие</h2>
          {data.past.map((t) => (
            <TournamentCard key={t.id} t={t} onOpen={onOpen} />
          ))}
        </section>
      )}
    </div>
  );
}

function TournamentCard({ t, onOpen }: { t: TournamentCardData; onOpen: (id: number) => void }) {
  const now = useNow();
  const startsIn = now === null ? null : new Date(t.startsAt).getTime() - now;
  const badge =
    t.status === "live"
      ? "🔴 Идёт"
      : t.status === "finished"
        ? "🏁 Завершён"
        : t.status === "cancelled"
          ? "❌ Отменён"
          : startsIn !== null && startsIn > 0
            ? `⏳ ${formatCountdown(startsIn)}`
            : "⏳ Скоро старт";

  return (
    <button
      onClick={() => onOpen(t.id)}
      className={`flex w-full flex-col gap-1 rounded-2xl p-4 text-left ${
        t.status === "registration" || t.status === "live"
          ? "bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-700 text-white"
          : "bg-tg-secondary-bg"
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-black">{t.title}</span>
        <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-xs font-bold">{badge}</span>
      </span>
      <span className="text-sm opacity-90">
        {new Date(t.startsAt).toLocaleString("ru-RU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        {" · "}
        👥 {t.participants}/{t.maxPlayers}
      </span>
      {t.joined && <span className="text-sm font-bold">✅ Ты участвуешь</span>}
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
