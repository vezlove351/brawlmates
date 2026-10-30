"use client";

import { useCallback, useEffect, useState } from "react";
import { openTelegramLink } from "@telegram-apps/sdk-react";
import { apiPost } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { Button } from "./Button";
import { PlayerAvatar } from "./PlayerAvatar";
import { formatCountdown, useNow } from "./useNow";

interface PageData {
  tournament: {
    id: number;
    title: string;
    description: string | null;
    startsAt: string;
    map: string | null;
    rounds: number;
    pointsByPlace: number[];
    maxPlayers: number;
    condition: "all" | "channel" | "min_trophies";
    minTrophies: number | null;
    status: "draft" | "registration" | "live" | "finished" | "cancelled";
  };
  link: string;
  participants: { tag: string; name: string; trophies: number | null; iconId: number | null; isMe: boolean }[];
  joined: boolean;
  canLeave: boolean;
  standings: { playerTag: string; name: string; points: number; roundsPlayed: number; position: number; isMe: boolean }[];
}

const CONDITION = {
  all: "Все игроки Brawlmates",
  channel: "Подписчики канала @brawlmate_app",
  min_trophies: "",
};

// Страница турнира: описание, таймер, участники, запись.
export function TournamentPage({
  id,
  onBack,
  onOpenProfile,
}: {
  id: number;
  onBack: () => void;
  onOpenProfile: (tag: string) => void;
}) {
  const [data, setData] = useState<PageData | string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    const result = await apiPost<PageData>("/api/tournaments/page", { id });
    setData(result.ok ? result.data : result.error);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    apiPost<PageData>("/api/tournaments/page", { id }).then((result) => {
      if (!cancelled) setData(result.ok ? result.data : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(path: string) {
    setBusy(true);
    setError(null);
    const result = await apiPost(path, { id });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    await load();
  }

  const back = (
    <button onClick={onBack} className="self-start text-sm font-semibold text-tg-link">
      ← Все турниры
    </button>
  );

  if (data === null) return <div className="flex flex-col gap-3">{back}<div className="h-96 animate-pulse rounded-2xl bg-tg-secondary-bg" /></div>;
  if (typeof data === "string") return <div className="flex flex-col gap-3">{back}<p className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm">{data}</p></div>;

  const t = data.tournament;
  const startsIn = now === null ? null : new Date(t.startsAt).getTime() - now;
  const full = data.participants.length >= t.maxPlayers;
  const condition = t.condition === "min_trophies" ? `От ${formatNumber(t.minTrophies ?? 0)} трофеев` : CONDITION[t.condition];

  function invite() {
    const text = `Го со мной на турнир «${t.title}» в Brawlmates! Участие бесплатное 🏆`;
    openTelegramLink.ifAvailable(`https://t.me/share/url?url=${encodeURIComponent(data && typeof data !== "string" ? data.link : "")}&text=${encodeURIComponent(text)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {back}

      <header className="flex flex-col gap-2 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-700 p-5 text-white shadow-lg">
        <h1 className="text-2xl font-black drop-shadow-sm">🏆 {t.title}</h1>
        <p className="text-sm text-white/90">
          {new Date(t.startsAt).toLocaleString("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-3xl font-black">
          {t.status === "registration" && startsIn !== null
            ? startsIn > 0
              ? `⏳ ${formatCountdown(startsIn)}`
              : "Скоро старт!"
            : t.status === "live"
              ? "🔴 Турнир идёт"
              : t.status === "finished"
                ? "🏁 Завершён"
                : t.status === "cancelled"
                  ? "❌ Отменён"
                  : "📝 Черновик"}
        </p>
      </header>

      {t.description && <p className="rounded-2xl bg-tg-secondary-bg p-4 text-sm">{t.description}</p>}

      <section className="grid grid-cols-2 gap-2 text-sm">
        <Info label="Режим" value={`Одиночное столкновение${t.map ? ` · ${t.map}` : ""}`} />
        <Info label="Раундов" value={String(t.rounds)} />
        <Info label="Очки за места" value={t.pointsByPlace.join(" / ")} />
        <Info label="Кто может участвовать" value={condition} />
      </section>

      {t.status === "registration" && (
        <section className="flex flex-col gap-2">
          {data.joined ? (
            <>
              <p className="rounded-2xl bg-tg-button px-4 py-3 text-center font-bold text-tg-button-text">✅ Ты участвуешь!</p>
              <p className="text-center text-xs text-tg-hint">
                Бот напомнит за час и за 10 минут, а перед каждым раундом пришлёт ссылку на комнату.
              </p>
              {data.canLeave && (
                <button className="text-sm font-semibold text-red-500" disabled={busy} onClick={() => act("/api/tournaments/leave")}>
                  Отменить участие
                </button>
              )}
            </>
          ) : full ? (
            <p className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm">Все места заняты 😔</p>
          ) : (
            <Button disabled={busy || (startsIn !== null && startsIn <= 0)} onClick={() => act("/api/tournaments/join")}>
              🏆 Участвовать — бесплатно
            </Button>
          )}
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          <Button variant="secondary" className="bg-tg-secondary-bg! py-2 text-sm" onClick={invite}>
            📨 Позвать друга в турнир
          </Button>
        </section>
      )}

      {data.standings.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl bg-tg-secondary-bg p-4">
          <h2 className="font-semibold">Таблица очков</h2>
          <ol className="flex flex-col gap-1.5">
            {data.standings.map((s) => (
              <li key={s.playerTag} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${s.isMe ? "bg-tg-button/20" : ""}`}>
                <span className="w-7 text-center font-black">{s.position <= 3 ? ["🥇", "🥈", "🥉"][s.position - 1] : s.position}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {s.name}
                  {s.isMe && " (ты)"}
                </span>
                <span className="font-black">{s.points}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tg-hint">
          Участники · {data.participants.length}/{t.maxPlayers}
        </h2>
        {data.participants.length === 0 ? (
          <p className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">Пока никого — будь первым!</p>
        ) : (
          data.participants.map((p) => (
            <button
              key={p.tag}
              disabled={p.isMe}
              onClick={() => onOpenProfile(p.tag)}
              className="flex items-center gap-3 rounded-2xl bg-tg-secondary-bg p-2 text-left"
            >
              <PlayerAvatar iconId={p.iconId} size={36} />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.name}
                {p.isMe && " (ты)"}
              </span>
              {p.trophies !== null && <span className="shrink-0 text-sm text-tg-hint">🏆 {formatNumber(p.trophies)}</span>}
            </button>
          ))
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-tg-secondary-bg p-3">
      <p className="text-xs text-tg-hint">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
