"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { plural } from "@/lib/format";
import { modeName } from "@/lib/modes";
import { BrawlerIcon } from "./BrawlerIcon";

interface Stats {
  members: number;
  together: number;
  wins?: number;
  winRate?: number;
  modes?: { mode: string; games: number; wins: number }[];
  maps?: { mode: string; map: string; games: number; wins: number }[];
  combos?: { brawlers: { id: number; name: string | null }[]; games: number; wins: number }[];
}

const pct = (wins: number, games: number) => `${Math.round((wins / games) * 100)}%`;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

// Статистика команды по совместным боям. teamSize — чтобы перезагрузить при смене состава.
export function TeamStats({ teamSize }: { teamSize: number }) {
  const [stats, setStats] = useState<{ size: number; value: Stats | string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<Stats>("/api/team/stats").then((result) => {
      if (!cancelled) setStats({ size: teamSize, value: result.ok ? result.data : result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [teamSize]);

  const current = stats?.size === teamSize ? stats.value : null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <h2 className="font-semibold">📊 Статистика команды</h2>

      {current === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-tg-bg" />
      ) : typeof current === "string" ? (
        <p className="text-sm text-tg-hint">{current}</p>
      ) : current.members < 2 ? (
        <p className="text-sm text-tg-hint">Статистика появится, когда в команде будет хотя бы двое.</p>
      ) : current.together === 0 ? (
        <p className="text-sm text-tg-hint">
          Совместных боёв пока нет. Сыграйте вместе в одной команде — статистика появится после
          первых игр (бои сохраняются каждые 30 минут).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Боёв вместе" value={String(current.together)} />
            <Tile label="Побед" value={`${current.winRate}%`} hint={`${current.wins} из ${current.together}`} />
          </div>

          {current.modes && current.modes.length > 0 && (
            <List title="Лучшие режимы">
              {current.modes.map((m) => (
                <Row key={m.mode} label={modeName(m.mode)} games={m.games} wins={m.wins} />
              ))}
            </List>
          )}

          {current.maps && current.maps.length > 0 && (
            <List title="Лучшие карты">
              {current.maps.map((m) => (
                <Row key={`${m.mode}|${m.map}`} label={m.map} sub={modeName(m.mode)} games={m.games} wins={m.wins} />
              ))}
            </List>
          )}

          {current.combos && current.combos.length > 0 && (
            <List title="Удачные связки бравлеров">
              {current.combos.map((c) => (
                <li key={c.brawlers.map((b) => b.id).join(",")} className="flex items-center gap-2">
                  <span className="flex gap-1">
                    {c.brawlers.map((b) => (
                      <BrawlerIcon key={b.id} id={b.id} name={b.name ?? undefined} size={32} className="h-8 w-8 rounded-lg" />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.brawlers.map((b) => (b.name ? titleCase(b.name) : "?")).join(" + ")}
                  </span>
                  <Score games={c.games} wins={c.wins} />
                </li>
              ))}
            </List>
          )}

          <p className="text-xs text-tg-hint">
            Учитываются бои, где вы были в одной команде, начиная с появления этой статистики.
          </p>
        </>
      )}
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-tg-bg p-3">
      <p className="text-xs text-tg-hint">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {hint && <p className="text-xs text-tg-hint">{hint}</p>}
    </div>
  );
}

function List({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold text-tg-hint">{title}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function Row({ label, sub, games, wins }: { label: string; sub?: string; games: number; wins: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        {sub && <span className="block truncate text-xs text-tg-hint">{sub}</span>}
      </span>
      <Score games={games} wins={wins} />
    </li>
  );
}

function Score({ games, wins }: { games: number; wins: number }) {
  return (
    <span className="shrink-0 text-right text-sm">
      <span className="font-bold">{pct(wins, games)}</span>{" "}
      <span className="text-xs text-tg-hint">· {games} {plural(games, ["бой", "боя", "боёв"])}</span>
    </span>
  );
}
