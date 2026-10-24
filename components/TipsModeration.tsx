"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { TipCard } from "@/lib/tips";
import { Button } from "./Button";
import { TipCardView } from "./TipCardView";
import { useTelegramStatus } from "./TelegramProvider";

interface ReportedTip extends TipCard {
  reports: number;
  reasons: string[];
}

const REASON_LABELS: Record<string, string> = { rude: "грубость", spam: "спам", scam: "обман", other: "другое" };

// Модерация советов: очередь на проверку и советы с жалобами.
export function TipsModeration() {
  const telegram = useTelegramStatus();
  const [data, setData] = useState<{ pending: TipCard[]; reported: ReportedTip[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (telegram !== "ready") return;
    let cancelled = false;
    apiPost<{ pending: TipCard[]; reported: ReportedTip[] }>("/api/admin/tips").then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.status === 403 ? "Нет доступа к модерации." : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [telegram]);

  async function resolve(tipId: number, action: string) {
    setBusyId(tipId);
    const result = await apiPost("/api/admin/tips/resolve", { tipId, action });
    setBusyId(null);
    if (!result.ok) return setError(result.error);
    // Убираем решённый совет из обеих очередей.
    setData((d) =>
      d ? { pending: d.pending.filter((t) => t.id !== tipId), reported: d.reported.filter((t) => t.id !== tipId) } : d,
    );
  }

  if (error) return <Note>{error}</Note>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-tg-secondary-bg" />;

  const button = "px-2 py-2 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tg-hint">На проверке · {data.pending.length}</h2>
        {data.pending.length === 0 ? (
          <Note>Очередь пуста 🎉</Note>
        ) : (
          data.pending.map((tip) => (
            <TipCardView
              key={tip.id}
              tip={tip}
              actions={
                <div className="grid grid-cols-2 gap-2">
                  <Button className={button} disabled={busyId === tip.id} onClick={() => resolve(tip.id, "approve")}>
                    ✅ Одобрить
                  </Button>
                  <Button className={`${button} bg-red-600! text-white!`} disabled={busyId === tip.id} onClick={() => resolve(tip.id, "reject")}>
                    Отклонить
                  </Button>
                </div>
              }
            />
          ))
        )}
        <p className="text-xs text-tg-hint">Первые 3 совета каждого автора проходят проверку, дальше публикуются сразу.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tg-hint">С жалобами · {data.reported.length}</h2>
        {data.reported.length === 0 ? (
          <Note>Жалоб нет 🎉</Note>
        ) : (
          data.reported.map((tip) => (
            <TipCardView
              key={tip.id}
              tip={tip}
              actions={
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-tg-hint">
                    ⚠️ {tip.reports} · {tip.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
                    {tip.status === "hidden" && " · скрыт до проверки"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button className={button} disabled={busyId === tip.id} onClick={() => resolve(tip.id, "keep")}>
                      Оставить
                    </Button>
                    <Button className={`${button} bg-amber-600! text-white!`} disabled={busyId === tip.id} onClick={() => resolve(tip.id, "remove")}>
                      Удалить
                    </Button>
                    <Button className={`${button} bg-red-600! text-white!`} disabled={busyId === tip.id} onClick={() => resolve(tip.id, "ban")}>
                      Блок
                    </Button>
                  </div>
                </div>
              }
            />
          ))
        )}
      </section>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
