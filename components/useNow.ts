"use client";

import { useSyncExternalStore } from "react";

// Общие «часы» для всех таймеров на странице: тикают раз в 30 секунд.
// Время берётся только в браузере; при серверной отрисовке — null
// (Next.js не разрешает Date.now() при сборке страницы).
const TICK_MS = 30_000;
let now: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  now ??= Date.now();
  return now;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// "1 ч 45 мин", "12 мин", "меньше минуты"
export function formatTimeLeft(ms: number | null): string {
  if (ms === null) return "…";
  if (ms <= 0) return "истекла";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "меньше минуты";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}
