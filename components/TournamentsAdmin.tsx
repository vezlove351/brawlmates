"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { Button } from "./Button";
import { useTelegramStatus } from "./TelegramProvider";

interface AdminTournament {
  id: number;
  title: string;
  startsAt: string;
  status: "draft" | "registration" | "live" | "finished" | "cancelled";
  participants: number;
  maxPlayers: number;
  rounds: number;
  condition: string;
}

const STATUS: Record<AdminTournament["status"], string> = {
  draft: "📝 черновик",
  registration: "✅ идёт запись",
  live: "🔴 идёт",
  finished: "🏁 завершён",
  cancelled: "❌ отменён",
};

const fieldClass = "w-full rounded-xl border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm outline-none focus:border-tg-button";

// Турниры в /admin: создание и список.
export function TournamentsAdmin() {
  const telegram = useTelegramStatus();
  const [list, setList] = useState<AdminTournament[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const result = await apiPost<{ tournaments: AdminTournament[] }>("/api/admin/tournaments");
    if (result.ok) setList(result.data.tournaments);
    else setError(result.status === 403 ? "Нет доступа к модерации." : result.error);
  }, []);

  useEffect(() => {
    if (telegram !== "ready") return;
    let cancelled = false;
    apiPost<{ tournaments: AdminTournament[] }>("/api/admin/tournaments").then((result) => {
      if (cancelled) return;
      if (result.ok) setList(result.data.tournaments);
      else setError(result.status === 403 ? "Нет доступа к модерации." : result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [telegram]);

  async function act(path: string, body: object, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await apiPost(path, body);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setNotice(success);
    setConfirmOpen(null);
    await reload();
  }

  return (
    <div className="flex flex-col gap-4">
      <CreateForm onCreated={async () => { setNotice("Черновик создан. Проверь и открой регистрацию 👇"); await reload(); }} />

      {notice && <p className="rounded-2xl bg-tg-button px-4 py-3 text-center text-sm font-semibold text-tg-button-text">{notice}</p>}
      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tg-hint">Все турниры</h2>
        {!list ? (
          <div className="h-24 animate-pulse rounded-2xl bg-tg-secondary-bg" />
        ) : list.length === 0 ? (
          <p className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">Турниров пока нет</p>
        ) : (
          list.map((t) => (
            <article key={t.id} className="flex flex-col gap-2 rounded-2xl bg-tg-secondary-bg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{t.title}</p>
                  <p className="text-xs text-tg-hint">
                    {new Date(t.startsAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {t.participants}/{t.maxPlayers} игроков · {t.rounds} раунд.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold">{STATUS[t.status]}</span>
              </div>
              {t.status === "draft" &&
                (confirmOpen === t.id ? (
                  <div className="flex flex-col gap-2 rounded-xl bg-tg-bg p-3 text-sm">
                    <p>Откроется запись, и в канал @brawlmate_app уйдёт анонс с кнопкой «Участвовать». Точно?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button className="py-2 text-sm" disabled={busy} onClick={() => act("/api/admin/tournaments/open", { id: t.id }, "Регистрация открыта, анонс отправлен в канал 📣")}>
                        Да, открыть
                      </Button>
                      <Button variant="secondary" className="bg-tg-secondary-bg! py-2 text-sm" onClick={() => setConfirmOpen(null)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Button className="py-2 text-sm" onClick={() => setConfirmOpen(t.id)}>
                      📣 Открыть регистрацию
                    </Button>
                    <Button
                      variant="secondary"
                      className="bg-tg-bg! px-3 py-2 text-sm text-red-500!"
                      disabled={busy}
                      onClick={() => act("/api/admin/tournaments/delete", { id: t.id }, "Черновик удалён")}
                    >
                      Удалить
                    </Button>
                  </div>
                ))}
            </article>
          ))
        )}
      </section>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "19:00",
    map: "",
    rounds: "3",
    points: "10, 7, 5, 4, 3, 2, 1",
    maxPlayers: "10",
    condition: "all",
    minTrophies: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    if (!form.date) return setError("Выбери дату");
    // Дата и время — по часам телефона организатора; на сервер — точный момент в UTC.
    const startsAt = new Date(`${form.date}T${form.time}`).toISOString();
    setBusy(true);
    setError(null);
    const result = await apiPost("/api/admin/tournaments/create", {
      title: form.title,
      description: form.description,
      startsAt,
      map: form.map,
      rounds: Number(form.rounds),
      pointsByPlace: form.points.split(/[\s,;]+/).filter(Boolean).map(Number),
      maxPlayers: Number(form.maxPlayers),
      condition: form.condition,
      minTrophies: form.minTrophies ? Number(form.minTrophies) : null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    set({ title: "", description: "" });
    onCreated();
  }

  if (!open) return <Button onClick={() => setOpen(true)}>➕ Создать турнир</Button>;

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <h2 className="text-lg font-bold">Новый турнир · Showdown</h2>
      <Field label="Название">
        <input className={fieldClass} value={form.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} placeholder="Кубок Brawlmates #1" />
      </Field>
      <Field label="Описание (необязательно)">
        <textarea className={`${fieldClass} min-h-16 resize-none`} maxLength={500} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Дата">
          <input type="date" className={fieldClass} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label="Время (по твоим часам)">
          <input type="time" className={fieldClass} value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
      </div>
      <Field label="Карта (можно из Map Maker)">
        <input className={fieldClass} value={form.map} maxLength={60} onChange={(e) => set({ map: e.target.value })} placeholder="Skull Creek" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Раундов">
          <input type="number" min={1} max={10} className={fieldClass} value={form.rounds} onChange={(e) => set({ rounds: e.target.value })} />
        </Field>
        <Field label="Участников (до 10)">
          <input type="number" min={2} max={10} className={fieldClass} value={form.maxPlayers} onChange={(e) => set({ maxPlayers: e.target.value })} />
        </Field>
      </div>
      <Field label="Очки за 1-е, 2-е, 3-е… место">
        <input className={fieldClass} value={form.points} onChange={(e) => set({ points: e.target.value })} />
      </Field>
      <Field label="Кто может участвовать">
        <select className={fieldClass} value={form.condition} onChange={(e) => set({ condition: e.target.value })}>
          <option value="all">Все игроки Brawlmates</option>
          <option value="channel">Подписчики канала @brawlmate_app</option>
          <option value="min_trophies">От N трофеев</option>
        </select>
      </Field>
      {form.condition === "min_trophies" && (
        <Field label="Минимум трофеев">
          <input type="number" min={1} className={fieldClass} value={form.minTrophies} onChange={(e) => set({ minTrophies: e.target.value })} />
        </Field>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy || form.title.trim().length < 3} onClick={submit}>
          Создать черновик
        </Button>
        <Button variant="secondary" className="bg-tg-bg!" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
      <p className="text-xs text-tg-hint">Участие всегда бесплатное. Черновик видишь только ты — до открытия регистрации.</p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-tg-hint">{label}</span>
      {children}
    </label>
  );
}
