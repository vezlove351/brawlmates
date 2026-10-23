"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { apiPost } from "@/lib/api-client";
import type { PlayerProfile } from "@/lib/brawlstars";
import { formatNumber } from "@/lib/format";
import {
  bracketFor,
  findMode,
  LFG_COMMENT_MAX,
  LFG_LANGUAGES,
  LFG_MAX_BRAWLERS,
  LFG_MODES,
  TROPHY_BRACKETS,
  type LfgPostInput,
} from "@/lib/lfg";
import type { PublicLfgPost } from "@/lib/lfg-server";
import { BrawlerPicker } from "./BrawlerPicker";
import { Button } from "./Button";
import { ChipGroup } from "./ChipGroup";

interface LfgFormProps {
  profile: PlayerProfile;
  postsLeftToday: number;
  onCreated: (post: PublicLfgPost) => void;
}

// Форма «Найти тиммейта». Только готовые варианты + короткий комментарий.
// Трофеи и бравлеры берём из профиля автоматически.
export function LfgForm({ profile, postsLeftToday, onCreated }: LfgFormProps) {
  const brawlers = [...profile.brawlers].sort((a, b) => b.trophies - a.trophies);

  const [form, setForm] = useState<LfgPostInput>({
    mode: "ranked",
    // По умолчанию — самый прокачанный бравлер.
    brawlerIds: brawlers.length > 0 ? [brawlers[0].id] : [],
    bracket: bracketFor(profile.trophies).id,
    language: "ru",
    playersNeeded: 2,
    comment: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mode = findMode(form.mode);
  const maxPlayers = mode?.maxPlayers ?? 2;
  const update = (patch: Partial<LfgPostInput>) => setForm((f) => ({ ...f, ...patch }));

  function changeMode(id: string) {
    const max = findMode(id)?.maxPlayers ?? 2;
    // В «Парном столкновении» нужен только один напарник.
    update({ mode: id, playersNeeded: Math.min(form.playersNeeded, max) });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await apiPost<{ post: PublicLfgPost }>("/api/lfg/create", form);
    setBusy(false);
    if (result.ok) onCreated(result.data.post);
    else setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl bg-tg-secondary-bg p-4">
      <div>
        <h2 className="text-xl font-bold">Найти тиммейта</h2>
        <p className="text-sm text-tg-hint">
          Заявка будет видна 2 часа. Твои трофеи: 🏆 {formatNumber(profile.trophies)}
        </p>
      </div>

      <Field label="Режим">
        <ChipGroup
          options={LFG_MODES.map((m) => ({ value: m.id, label: `${m.emoji} ${m.label}` }))}
          value={form.mode}
          onChange={changeMode}
        />
      </Field>

      <Field label={`Чем буду играть (до ${LFG_MAX_BRAWLERS})`}>
        <BrawlerPicker
          brawlers={brawlers}
          selected={form.brawlerIds}
          max={LFG_MAX_BRAWLERS}
          onChange={(brawlerIds) => update({ brawlerIds })}
        />
      </Field>

      <Field label="Трофеи тиммейта">
        <ChipGroup
          options={TROPHY_BRACKETS.map((b) => ({ value: b.id, label: b.label }))}
          value={form.bracket}
          onChange={(bracket) => update({ bracket })}
        />
      </Field>

      <Field label="Сколько игроков нужно">
        <ChipGroup
          options={[1, 2].map((n) => ({ value: n, label: String(n), disabled: n > maxPlayers }))}
          value={form.playersNeeded}
          onChange={(playersNeeded) => update({ playersNeeded })}
        />
      </Field>

      <Field label="Язык">
        <ChipGroup
          options={LFG_LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
          value={form.language}
          onChange={(language) => update({ language })}
        />
      </Field>

      <Field label="Комментарий (необязательно)">
        <input
          value={form.comment}
          onChange={(e) => update({ comment: e.target.value })}
          maxLength={LFG_COMMENT_MAX}
          placeholder="Например: играю спокойно, без токсичности"
          className="w-full rounded-xl border border-tg-hint/30 bg-tg-bg px-3 py-2.5 outline-none focus:border-tg-button"
        />
        <p className="text-right text-xs text-tg-hint">
          {form.comment.length}/{LFG_COMMENT_MAX}
        </p>
      </Field>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button type="submit" disabled={busy || form.brawlerIds.length === 0 || postsLeftToday === 0}>
        {busy ? "Публикую…" : "Опубликовать заявку"}
      </Button>
      <p className="text-center text-xs text-tg-hint">
        {postsLeftToday > 0
          ? `Сегодня можно создать ещё ${postsLeftToday}`
          : "На сегодня заявки закончились — возвращайся завтра"}
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-tg-hint">{label}</p>
      {children}
    </div>
  );
}
