"use client";

import { useState, type FormEvent } from "react";
import { apiPost } from "@/lib/api-client";
import { Button } from "./Button";
import type { LinkChallenge } from "./IconCheck";

export function TagForm({ onStarted }: { onStarted: (challenge: LinkChallenge) => void }) {
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await apiPost<LinkChallenge>("/api/link/start", { tag });
    setBusy(false);
    if (result.ok) onStarted(result.data);
    else setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-tg-hint">
        Тег — это твой номер игрока. Найти его просто: в игре нажми на свой профиль в левом
        верхнем углу. Тег написан под ником и начинается с&nbsp;<b>#</b>.
      </p>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="#ABC123XY"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="rounded-xl border border-tg-hint/30 bg-tg-bg px-4 py-3 text-lg uppercase outline-none focus:border-tg-button"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={busy || tag.trim().length < 3}>
        {busy ? "Ищу игрока…" : "Найти"}
      </Button>
    </form>
  );
}
