"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { Button } from "./Button";

type Relation = "self" | "none" | "outgoing" | "incoming" | "friends";

// Кнопка дружбы на чужом профиле. Её состояние приходит с сервера.
export function FriendButton({ playerTag }: { playerTag: string }) {
  const [relation, setRelation] = useState<{ tag: string; value: Relation | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiPost<{ relation: Relation }>("/api/friends/status", { tag: playerTag }).then((result) => {
      // Игрока нет в Brawlmates — кнопку просто не показываем.
      if (!cancelled) setRelation({ tag: playerTag, value: result.ok ? result.data.relation : null });
    });
    return () => {
      cancelled = true;
    };
  }, [playerTag]);

  const current = relation?.tag === playerTag ? relation.value : null;

  async function run(path: string, body: object, next: Relation | ((r: { relation?: Relation }) => Relation)) {
    setBusy(true);
    setError(null);
    const result = await apiPost<{ relation?: Relation }>(path, { tag: playerTag, ...body });
    setBusy(false);
    if (result.ok) {
      setRelation({ tag: playerTag, value: typeof next === "function" ? next(result.data) : next });
      setConfirmRemove(false);
    } else setError(result.error);
  }

  if (!current || current === "self") return null;

  return (
    <div className="flex flex-col gap-2">
      {current === "none" && (
        <Button disabled={busy} onClick={() => run("/api/friends/request", {}, (d) => d.relation ?? "outgoing")}>
          ➕ Добавить в друзья
        </Button>
      )}

      {current === "outgoing" && <Button disabled>⏳ Заявка отправлена</Button>}

      {current === "incoming" && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button disabled={busy} onClick={() => run("/api/friends/answer", { accept: true }, "friends")}>
            ✅ Принять заявку
          </Button>
          <Button
            variant="secondary"
            className="bg-tg-secondary-bg! px-3"
            disabled={busy}
            onClick={() => run("/api/friends/answer", { accept: false }, "none")}
          >
            Отклонить
          </Button>
        </div>
      )}

      {current === "friends" && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-tg-secondary-bg px-4 py-3">
          <span className="font-semibold">🤝 Вы друзья</span>
          {confirmRemove ? (
            <span className="flex gap-3 text-sm font-semibold">
              <button className="text-red-500" disabled={busy} onClick={() => run("/api/friends/remove", {}, "none")}>
                Удалить
              </button>
              <button className="text-tg-hint" onClick={() => setConfirmRemove(false)}>
                Отмена
              </button>
            </span>
          ) : (
            <button className="text-sm font-semibold text-tg-hint" onClick={() => setConfirmRemove(true)}>
              Удалить из друзей
            </button>
          )}
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </div>
  );
}
