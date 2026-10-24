"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { findMode } from "@/lib/lfg";
import { Button } from "./Button";
import { Tabs } from "./Tabs";
import { useTelegramStatus } from "./TelegramProvider";
import { TipsModeration } from "./TipsModeration";

interface ReportItem {
  postId: number;
  playerTag: string;
  playerName: string;
  mode: string;
  comment: string | null;
  status: string;
  createdAt: string;
  authorBanned: boolean;
  reports: number;
  reasons: string[];
}

const REASON_LABELS: Record<string, string> = {
  rude: "грубость",
  spam: "спам",
  scam: "обман",
  other: "другое",
};

const STATUS_LABELS: Record<string, string> = {
  active: "в ленте",
  hidden: "скрыта жалобами",
  expired: "истекла",
  closed: "закрыта автором",
  removed: "удалена",
};

// Страница модерации. Доступ — только для ADMIN_IDS (проверяет сервер при каждом запросе).
export function AdminScreen() {
  const telegram = useTelegramStatus();
  const [tab, setTab] = useState<"lfg" | "tips">("lfg");
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🛡️ Модерация</h1>
        <Link href="/" className="text-sm font-semibold text-tg-link">
          ← В приложение
        </Link>
      </div>
      {telegram === "outside" ? (
        <Note>Открой эту страницу внутри Telegram.</Note>
      ) : (
        <>
          <Tabs
            options={[
              { value: "lfg", label: "Заявки LFG" },
              { value: "tips", label: "💡 Советы" },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "lfg" ? <LfgModeration /> : <TipsModeration />}
        </>
      )}
    </div>
  );
}

// Жалобы на заявки LFG.
function LfgModeration() {
  const telegram = useTelegramStatus();
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (telegram !== "ready") return;
    let cancelled = false;
    apiPost<{ items: ReportItem[] }>("/api/admin/reports").then((result) => {
      if (cancelled) return;
      if (result.ok) setItems(result.data.items);
      else setError(result.status === 403 ? "Нет доступа к модерации." : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [telegram]);

  async function resolve(postId: number, action: "keep" | "remove" | "ban") {
    setBusyId(postId);
    const result = await apiPost("/api/admin/resolve", { postId, action });
    setBusyId(null);
    if (result.ok) setItems((list) => list?.filter((i) => i.postId !== postId) ?? null);
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Note>{error}</Note>}
      {!error && telegram !== "outside" && !items && (
        <div className="h-40 animate-pulse rounded-2xl bg-tg-secondary-bg" />
      )}
      {items?.length === 0 && <Note>Жалоб нет 🎉</Note>}

      {items?.map((item) => {
        const mode = findMode(item.mode);
        return (
          <article key={item.postId} className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
            <header className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{item.playerName}</p>
                <p className="text-xs text-tg-hint">
                  {item.playerTag} · {mode?.label ?? item.mode} · {STATUS_LABELS[item.status] ?? item.status}
                  {item.authorBanned && " · автор заблокирован"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                ⚠️ {item.reports}
              </span>
            </header>

            <p className="rounded-xl bg-tg-bg px-3 py-2 text-sm">
              {item.comment ? `💬 ${item.comment}` : <span className="text-tg-hint">без комментария</span>}
            </p>
            <p className="text-xs text-tg-hint">
              Причины: {item.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <Button className="px-2 py-2 text-sm" disabled={busyId === item.postId} onClick={() => resolve(item.postId, "keep")}>
                Оставить
              </Button>
              <Button
                className="bg-amber-600! px-2 py-2 text-sm text-white!"
                disabled={busyId === item.postId}
                onClick={() => resolve(item.postId, "remove")}
              >
                Удалить
              </Button>
              <Button
                className="bg-red-600! px-2 py-2 text-sm text-white!"
                disabled={busyId === item.postId}
                onClick={() => resolve(item.postId, "ban")}
              >
                Блок
              </Button>
            </div>
          </article>
        );
      })}

      <p className="text-center text-xs text-tg-hint">
        «Оставить» — вернуть в ленту, «Удалить» — убрать заявку, «Блок» — удалить и заблокировать автора.
      </p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
