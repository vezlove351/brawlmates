"use client";

import { useEffect, useState } from "react";
import { miniApp } from "@telegram-apps/sdk-react";
import { apiPost } from "@/lib/api-client";
import { Button } from "./Button";

interface Settings {
  showTelegramContact: boolean;
  hiddenPlayers: { tag: string; name: string }[];
}

// Настройки приватности, скрытые игроки и удаление аккаунта.
export function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiPost<Settings>("/api/settings").then((result) => {
      if (cancelled) return;
      if (result.ok) setSettings(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleContact(show: boolean) {
    setBusy(true);
    setError(null);
    const result = await apiPost<{ showTelegramContact: boolean }>("/api/settings/update", {
      showTelegramContact: show,
    });
    setBusy(false);
    if (result.ok) setSettings((s) => (s ? { ...s, showTelegramContact: result.data.showTelegramContact } : s));
    else setError(result.error);
  }

  async function unhide(tag: string) {
    const result = await apiPost("/api/settings/unhide", { tag });
    if (result.ok) {
      setSettings((s) => (s ? { ...s, hiddenPlayers: s.hiddenPlayers.filter((p) => p.tag !== tag) } : s));
    } else setError(result.error);
  }

  async function deleteAccount() {
    setBusy(true);
    const result = await apiPost("/api/account/delete");
    setBusy(false);
    if (result.ok) setDeleted(true);
    else setError(result.error);
  }

  if (deleted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-tg-secondary-bg p-6 text-center">
        <p className="text-4xl">👋</p>
        <p className="font-semibold">Аккаунт и все данные удалены.</p>
        <p className="text-sm text-tg-hint">
          Если захочешь вернуться — просто открой приложение снова и привяжи тег.
        </p>
        <Button onClick={() => miniApp.close.ifAvailable()}>Закрыть приложение</Button>
      </div>
    );
  }

  if (!settings) {
    return error ? <Card>{error}</Card> : <div className="h-64 animate-pulse rounded-2xl bg-tg-secondary-bg" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Настройки</h1>

      <Card>
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block font-semibold">Показывать мой Telegram</span>
            <span className="block text-sm text-tg-hint">
              Твой @username увидят в твоих заявках и в откликах «Я в деле». Если выключено —
              с тобой свяжутся только через игру, по тегу.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-6 w-6 shrink-0 accent-(--color-tg-button)"
            checked={settings.showTelegramContact}
            disabled={busy}
            onChange={(e) => toggleContact(e.target.checked)}
          />
        </label>
      </Card>

      <Card>
        <p className="font-semibold">Скрытые игроки</p>
        {settings.hiddenPlayers.length === 0 ? (
          <p className="text-sm text-tg-hint">Ты пока никого не скрывал.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {settings.hiddenPlayers.map((p) => (
              <li key={p.tag} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                  {p.name} <span className="text-tg-hint">{p.tag}</span>
                </span>
                <button onClick={() => unhide(p.tag)} className="shrink-0 text-sm font-semibold text-tg-link">
                  Показать снова
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Card>
        <p className="font-semibold">Удалить аккаунт</p>
        <p className="text-sm text-tg-hint">
          Удалим всё: привязку тега, заявки, отклики, историю боёв и настройки. Отменить нельзя.
        </p>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button className="bg-red-600! text-white!" disabled={busy} onClick={deleteAccount}>
              Да, удалить всё
            </Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Отмена
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="text-red-500!" onClick={() => setConfirmDelete(true)}>
            Удалить аккаунт и все данные
          </Button>
        )}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">{children}</section>;
}
