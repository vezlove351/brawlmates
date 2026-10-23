"use client";

import { useState } from "react";
import { Button } from "./Button";
import { useNow } from "./useNow";

export interface TeamGameData {
  id: number;
  startsAt: string;
  myAnswer: "yes" | "no" | null;
  players: { name: string; isMe: boolean; answer: "yes" | "no" | null }[];
}

// Время игры по часам этого телефона: «сегодня в 19:00».
function formatLocal(iso: string, now: number | null): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (now !== null) {
    const day = (d: Date) => d.toDateString();
    if (day(date) === day(new Date(now))) return `сегодня в ${time}`;
    if (day(date) === day(new Date(now + 86_400_000))) return `завтра в ${time}`;
  }
  return `${date.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })} в ${time}`;
}

// «Играем сегодня»: ближайшая игра команды или форма, чтобы её назначить.
export function TeamGame({
  game,
  isCaptain,
  busy,
  act,
}: {
  game: TeamGameData | null;
  isCaptain: boolean;
  busy: boolean;
  act: (path: string, body?: object, success?: string) => Promise<boolean>;
}) {
  const now = useNow();

  if (!game) {
    return isCaptain ? (
      <ScheduleForm busy={busy} act={act} />
    ) : (
      <section className="rounded-2xl bg-tg-secondary-bg p-4 text-sm text-tg-hint">
        📅 Капитан пока не назначил игру. Когда назначит — бот пришлёт тебе сообщение.
      </section>
    );
  }

  const started = now !== null && new Date(game.startsAt).getTime() <= now;
  const icon = (a: "yes" | "no" | null) => (a === "yes" ? "✅" : a === "no" ? "❌" : "⏳");

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4 ring-2 ring-tg-button">
      <div>
        <p className="text-sm text-tg-hint">📅 Играем</p>
        <p className="text-xl font-black">{formatLocal(game.startsAt, now)}</p>
        {started && <p className="text-sm font-semibold text-green-600">Игра уже идёт!</p>}
      </div>

      <ul className="flex flex-col gap-1 text-sm">
        {game.players.map((p) => (
          <li key={p.name}>
            {icon(p.answer)} {p.name}
            {p.isMe && " (ты)"}
            <span className="text-tg-hint">
              {p.answer === "yes" ? " — будет" : p.answer === "no" ? " — не сможет" : " — ещё не ответил"}
            </span>
          </li>
        ))}
      </ul>

      {!started && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            className={`py-2 text-sm ${game.myAnswer === "yes" ? "" : "bg-tg-bg! text-tg-text!"}`}
            disabled={busy}
            onClick={() => act("/api/team/game/answer", { gameId: game.id, answer: "yes" })}
          >
            ✅ Буду
          </Button>
          <Button
            className={`py-2 text-sm ${game.myAnswer === "no" ? "bg-red-600! text-white!" : "bg-tg-bg! text-tg-text!"}`}
            disabled={busy}
            onClick={() => act("/api/team/game/answer", { gameId: game.id, answer: "no" })}
          >
            ❌ Не смогу
          </Button>
        </div>
      )}

      <p className="text-xs text-tg-hint">
        За 15 минут до начала бот напомнит тем, кто ответил «Буду». Время показано по часам твоего телефона.
      </p>

      {isCaptain && !started && (
        <button
          className="self-center text-sm font-semibold text-red-500"
          disabled={busy}
          onClick={() => act("/api/team/game/cancel", { gameId: game.id }, "Игра отменена, команда получит сообщение")}
        >
          Отменить игру
        </button>
      )}
    </section>
  );
}

function ScheduleForm({
  busy,
  act,
}: {
  busy: boolean;
  act: (path: string, body?: object, success?: string) => Promise<boolean>;
}) {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState("19:00");

  function submit() {
    const [h, m] = time.split(":").map(Number);
    // Время — по часам телефона капитана; на сервер уходит точный момент в UTC.
    const start = new Date();
    if (day === "tomorrow") start.setDate(start.getDate() + 1);
    start.setHours(h, m, 0, 0);
    act("/api/team/game/create", { startsAt: start.toISOString() }, "Игра назначена — бот уже зовёт команду 🎮");
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <h2 className="font-semibold">📅 Играем сегодня?</h2>
      <p className="text-sm text-tg-hint">
        Выбери время — бот спросит у каждого «Буду / Не смогу» и напомнит за 15 минут.
      </p>
      <div className="flex gap-2">
        {(["today", "tomorrow"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${day === d ? "bg-tg-button text-tg-button-text" : "bg-tg-bg"}`}
          >
            {d === "today" ? "Сегодня" : "Завтра"}
          </button>
        ))}
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="ml-auto rounded-xl border border-tg-hint/30 bg-tg-bg px-3 py-1.5 font-semibold outline-none"
        />
      </div>
      <Button disabled={busy || !time} onClick={submit}>
        Позвать команду
      </Button>
    </section>
  );
}
