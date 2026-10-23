"use client";

import { useState } from "react";
import { openTelegramLink, shareMessage } from "@telegram-apps/sdk-react";
import { apiPost } from "@/lib/api-client";
import { profileLink } from "@/lib/links";
import { Button } from "./Button";

// Кнопка «Поделиться профилем».
// 1) shareMessage — окно Telegram «переслать в чат» с готовым сообщением от бота:
//    картинка-карточка, подпись и кнопка «Открыть профиль».
// 2) Запасной вариант для старых клиентов — t.me/share/url: обычное окно выбора чата
//    с текстом и ссылкой (без картинки-карточки и кнопки).
export function ShareButton({ playerTag }: { playerTag: string }) {
  const [busy, setBusy] = useState(false);

  function shareViaLink(link: string, text: string) {
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    openTelegramLink.ifAvailable(url);
  }

  async function handleShare() {
    const link = profileLink(playerTag);

    // Старый клиент Telegram — сразу запасной вариант, без запроса к серверу.
    if (!shareMessage.isAvailable()) {
      shareViaLink(link, "Смотри мой профиль в Brawlmates!");
      return;
    }

    setBusy(true);
    const result = await apiPost<{ id: string; link: string; text: string }>("/api/share");
    setBusy(false);

    if (!result.ok) {
      // Сервер не смог подготовить сообщение — делимся хотя бы ссылкой.
      shareViaLink(link, "Смотри мой профиль в Brawlmates!");
      return;
    }

    try {
      await shareMessage(result.data.id);
    } catch {
      // Окно закрыли без отправки — это нормально, ничего не показываем.
    }
  }

  return (
    <Button onClick={handleShare} disabled={busy}>
      {busy ? "Готовлю карточку…" : "📤 Поделиться профилем"}
    </Button>
  );
}
