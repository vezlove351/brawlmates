"use client";

import Image from "next/image";
import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import { Button } from "./Button";

// То, что сервер вернул на шаге «Найти»: какой игрок и какую иконку поставить.
export interface LinkChallenge {
  player: { tag: string; name: string };
  icon: { id: number; url: string };
  expiresAt: string;
}

interface IconCheckProps {
  challenge: LinkChallenge;
  onLinked: (playerTag: string) => void;
  onRestart: () => void;
}

export function IconCheck({ challenge, onLinked, onRestart }: IconCheckProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCheck() {
    setBusy(true);
    setError(null);
    const result = await apiPost<{ player: { tag: string } }>("/api/link/confirm");
    setBusy(false);
    if (result.ok) onLinked(result.data.player.tag);
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        Нашли игрока <b>{challenge.player.name}</b> ({challenge.player.tag}). Теперь докажи, что
        это твой аккаунт, — поставь на время эту иконку профиля:
      </p>

      <Image
        src={challenge.icon.url}
        alt="Иконка, которую нужно поставить"
        width={120}
        height={120}
        className="mx-auto rounded-2xl"
        priority
      />

      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Открой Brawl Stars.</li>
        <li>Нажми на свой профиль в левом верхнем углу.</li>
        <li>Нажми на свою иконку рядом с ником.</li>
        <li>Найди и выбери иконку, как на картинке выше.</li>
        <li>Вернись сюда и нажми «Проверить».</li>
      </ol>

      <p className="text-sm text-tg-hint">
        Это нужно, чтобы никто не смог выдать себя за тебя. Сразу после проверки можешь вернуть
        свою любимую иконку. На всё есть 15 минут.
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-1">
        <Button onClick={handleCheck} disabled={busy}>
          {busy ? "Проверяю…" : "Проверить"}
        </Button>
        <Button variant="secondary" onClick={onRestart} disabled={busy}>
          Ввести другой тег
        </Button>
      </div>
    </div>
  );
}
