"use client";

import { useEffect, useState } from "react";
import type { Analysis } from "@/lib/analysis";
import { apiPost } from "@/lib/api-client";
import { plural } from "@/lib/format";
import { BrawlerIcon } from "./BrawlerIcon";

type Stat = Analysis["byMode"][number];

const games = (n: number) => `${n} ${plural(n, ["бой", "боя", "боёв"])}`;

// Вкладка «Разбор»: личная аналитика по сохранённым боям.
export function AnalysisTab() {
  const [state, setState] = useState<Analysis | string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<Analysis>("/api/analysis").then((result) => {
      if (!cancelled) setState(result.ok ? result.data : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === null) return <div className="h-96 animate-pulse rounded-3xl bg-tg-secondary-bg" />;
  if (typeof state === "string") return <Card>{state}</Card>;

  const a = state;
  if (a.total === 0) {
    return (
      <Card>
        <p className="text-sm text-tg-hint">
          Пока нет боёв для разбора. Мы сохраняем бои каждые 30 минут — сыграй несколько матчей и
          загляни позже.
        </p>
      </Card>
    );
  }

  const since = a.since
    ? new Date(a.since).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Боёв в разборе" value={String(a.total)} hint={since ? `с ${since}` : undefined} />
        <Tile label="Побед" value={`${a.winRate}%`} hint={`${a.wins} из ${a.total}`} />
      </div>

      <Card>
        <h3 className="font-semibold">💡 Что видно по твоим боям</h3>
        {a.tips.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {a.tips.map((tip) => (
              <li key={tip} className="rounded-xl bg-tg-bg px-3 py-2 text-sm">
                {tip}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tg-hint">
            Пока мало данных для честных выводов: нужно хотя бы по {a.tipMinGames} боёв на разных
            картах, бравлерах или режимах. Сыграй ещё — советы появятся сами.
          </p>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold">🔥 Серии</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniTile label="Лучшая серия побед" value={String(a.streaks.longestWin)} />
          <MiniTile label="Самая длинная серия поражений" value={String(a.streaks.longestLoss)} />
          <MiniTile
            label="Сейчас"
            value={
              a.streaks.current
                ? `${a.streaks.current.length} ${a.streaks.current.type === "win" ? "🏆" : "💀"}`
                : "—"
            }
          />
        </div>
      </Card>

      <Section title="🕒 Время дня" hint={a.timeZone ? undefined : "по UTC — открой приложение ещё раз, чтобы учесть твой часовой пояс"}>
        {a.byPeriod.map((s) => (
          <StatRow key={s.key} stat={s} />
        ))}
      </Section>

      <Section title="🥊 Бравлеры">
        {a.byBrawler.map((s) => (
          <StatRow
            key={s.key}
            stat={s}
            icon={<BrawlerIcon id={Number(s.key)} name={s.label} size={28} className="h-7 w-7 shrink-0 rounded-md" />}
          />
        ))}
      </Section>

      <Section title="🎮 Режимы">
        {a.byMode.map((s) => (
          <StatRow key={s.key} stat={s} />
        ))}
      </Section>

      <Section title="🗺️ Карты">
        {a.byMap.map((s) => (
          <StatRow key={s.key} stat={s} />
        ))}
      </Section>

      <p className="px-2 text-center text-xs text-tg-hint">
        Победа — выигранный бой 3 на 3; в «Столкновении» — верхняя половина таблицы. Ничьи не
        считаются. Бледным отмечено, где боёв пока мало.
      </p>
    </div>
  );
}

function StatRow({ stat, icon }: { stat: Stat; icon?: React.ReactNode }) {
  const few = stat.games < 3;
  return (
    <li className={`flex items-center gap-2 ${few ? "opacity-50" : ""}`}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">{stat.label}</span>
          <span className="shrink-0 text-sm">
            <b>{stat.rate}%</b> <span className="text-xs text-tg-hint">· {games(stat.games)}</span>
          </span>
        </span>
        {/* Полоска процента побед */}
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-tg-bg">
          <span className="block h-full rounded-full bg-tg-button" style={{ width: `${stat.rate}%` }} />
        </span>
      </span>
    </li>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="font-semibold">{title}</h3>
      {hint && <p className="-mt-2 text-xs text-tg-hint">{hint}</p>}
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-tg-secondary-bg p-3">
      <p className="text-xs text-tg-hint">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {hint && <p className="text-xs text-tg-hint">{hint}</p>}
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-tg-bg p-2">
      <p className="text-[11px] leading-tight text-tg-hint">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">{children}</section>;
}
