"use client";

import { useEffect, useMemo, useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { TipCard } from "@/lib/tips";
import { Button } from "./Button";
import { Tabs } from "./Tabs";
import { TipCardView } from "./TipCardView";

interface Item {
  id: number;
  name: string;
}

interface Catalog {
  brawlers: (Item & { gadgets: Item[]; starPowers: Item[]; gears: Item[] })[];
  myBrawlerIds: number[];
  modes: { id: string; label: string }[];
  mapsByMode: Record<string, string[]>;
}

type Sort = "useful" | "new";

const SORTS: { value: Sort; label: string }[] = [
  { value: "useful", label: "👍 Полезные" },
  { value: "new", label: "🆕 Новые" },
];

// Раздел «Советы»: лента карточек-советов с фильтрами и форма нового совета.
export function TipsScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [filters, setFilters] = useState({ brawlerId: "", mode: "", sort: "useful" as Sort });
  const [feed, setFeed] = useState<{ key: string; tips: TipCard[] } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiPost<Catalog>("/api/tips/catalog").then((result) => {
      if (cancelled) return;
      if (result.ok) setCatalog(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const key = `${JSON.stringify(filters)}#${reloadKey}`;
  useEffect(() => {
    let cancelled = false;
    apiPost<{ tips: TipCard[] }>("/api/tips", JSON.parse(key.split("#")[0])).then((result) => {
      if (cancelled) return;
      if (result.ok) setFeed({ key, tips: result.data.tips });
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const sortedBrawlers = useMemo(
    () => [...(catalog?.brawlers ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  const selectClass = "min-w-0 flex-1 rounded-xl bg-tg-secondary-bg px-2 py-2 text-sm font-semibold outline-none";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Советы</h1>

      {notice && <p className="rounded-2xl bg-tg-button px-4 py-3 text-center text-sm font-semibold text-tg-button-text">{notice}</p>}

      {showForm && catalog ? (
        <TipForm
          catalog={catalog}
          onCancel={() => setShowForm(false)}
          onCreated={(status) => {
            setShowForm(false);
            setNotice(
              status === "pending"
                ? "Совет отправлен на проверку — первые советы смотрит модератор. Обычно это быстро!"
                : "Совет опубликован, спасибо! 🙌",
            );
            setReloadKey((k) => k + 1);
          }}
        />
      ) : (
        <Button onClick={() => setShowForm(true)} disabled={!catalog}>
          ✍️ Написать совет
        </Button>
      )}

      <div className="flex gap-2">
        <select aria-label="Бравлер" className={selectClass} value={filters.brawlerId} onChange={(e) => setFilters({ ...filters, brawlerId: e.target.value })}>
          <option value="">🥊 Все бравлеры</option>
          {sortedBrawlers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select aria-label="Режим" className={selectClass} value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}>
          <option value="">🎮 Все режимы</option>
          {catalog?.modes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <Tabs options={SORTS} value={filters.sort} onChange={(sort) => setFilters({ ...filters, sort })} size="sm" />

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {!feed || feed.key !== key ? (
        <div className="h-48 animate-pulse rounded-2xl bg-tg-secondary-bg" />
      ) : feed.tips.length === 0 ? (
        <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">
          Советов пока нет. Будь первым — поделись тем, что работает у тебя!
        </div>
      ) : (
        feed.tips.map((tip) => <TipCardView key={tip.id} tip={tip} />)
      )}
    </div>
  );
}

export function TipForm({
  catalog,
  onCancel,
  onCreated,
}: {
  catalog: Catalog;
  onCancel: () => void;
  onCreated: (status: string) => void;
}) {
  // Советовать можно только по своим бравлерам.
  const myBrawlers = useMemo(
    () => catalog.brawlers.filter((b) => catalog.myBrawlerIds.includes(b.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );
  const [form, setForm] = useState({
    brawlerId: myBrawlers[0]?.id ?? 0,
    mode: "",
    map: "",
    gadgetId: "",
    starPowerId: "",
    gearId: "",
    text: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brawler = myBrawlers.find((b) => b.id === Number(form.brawlerId));
  const maps = form.mode ? catalog.mapsByMode[form.mode] ?? [] : [];
  const fieldClass = "w-full rounded-xl border border-tg-hint/30 bg-tg-bg px-3 py-2 text-sm outline-none focus:border-tg-button";

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await apiPost<{ tip: { status: string } }>("/api/tips/create", form);
    setBusy(false);
    if (result.ok) onCreated(result.data.tip.status);
    else setError(result.error);
  }

  if (myBrawlers.length === 0) {
    return <p className="rounded-2xl bg-tg-secondary-bg p-4 text-sm text-tg-hint">Не удалось загрузить твоих бравлеров. Открой «Профиль» и попробуй снова.</p>;
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <h2 className="text-lg font-bold">Новый совет</h2>

      <Labeled label="Бравлер (только свои)">
        <select
          className={fieldClass}
          value={form.brawlerId}
          // Сменили бравлера — сбрасываем его гаджет, звёздную силу и снаряжение.
          onChange={(e) => setForm({ ...form, brawlerId: Number(e.target.value), gadgetId: "", starPowerId: "", gearId: "" })}
        >
          {myBrawlers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Labeled>

      <div className="grid grid-cols-2 gap-2">
        <Labeled label="Режим">
          <select className={fieldClass} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value, map: "" })}>
            <option value="">Любой</option>
            {catalog.modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Карта">
          <select className={fieldClass} value={form.map} disabled={!form.mode} onChange={(e) => setForm({ ...form, map: e.target.value })}>
            <option value="">Любая</option>
            {maps.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Labeled>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ItemSelect label="🔧 Гаджет" items={brawler?.gadgets ?? []} value={form.gadgetId} onChange={(v) => setForm({ ...form, gadgetId: v })} className={fieldClass} />
        <ItemSelect label="⭐ Звёздная" items={brawler?.starPowers ?? []} value={form.starPowerId} onChange={(v) => setForm({ ...form, starPowerId: v })} className={fieldClass} />
        <ItemSelect label="⚙️ Снаряжение" items={brawler?.gears ?? []} value={form.gearId} onChange={(v) => setForm({ ...form, gearId: v })} className={fieldClass} />
      </div>

      <Labeled label="Совет">
        <textarea
          className={`${fieldClass} min-h-24 resize-none`}
          maxLength={200}
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
          placeholder="Например: держись за стенами и стреляй, когда враг подходит вплотную"
        />
        <p className="text-right text-xs text-tg-hint">{form.text.length}/200</p>
      </Labeled>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy || form.text.trim().length < 10} onClick={submit}>
          Опубликовать
        </Button>
        <Button variant="secondary" className="bg-tg-bg!" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-tg-hint">{label}</span>
      {children}
    </label>
  );
}

function ItemSelect({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: Item[];
  value: string;
  onChange: (v: string) => void;
  className: string;
}) {
  return (
    <Labeled label={label}>
      <select className={className} value={value} onChange={(e) => onChange(e.target.value)} disabled={items.length === 0}>
        <option value="">—</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </Labeled>
  );
}
