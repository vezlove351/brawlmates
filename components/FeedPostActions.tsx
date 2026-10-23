"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import type { FeedPost } from "@/lib/lfg-server";
import { Button } from "./Button";

const REASONS = [
  { value: "rude", label: "Грубость" },
  { value: "spam", label: "Спам" },
  { value: "scam", label: "Обман" },
  { value: "other", label: "Другое" },
] as const;

interface FeedPostActionsProps {
  post: FeedPost;
  onHidden: () => void; // автора скрыли — убрать его заявки из ленты
}

// Кнопки под заявкой в ленте: связаться, откликнуться, пожаловаться, скрыть.
export function FeedPostActions({ post, onHidden }: FeedPostActionsProps) {
  const [responded, setResponded] = useState(post.responded);
  const [reported, setReported] = useState(post.reported);
  const [panel, setPanel] = useState<"none" | "copied" | "report" | "hide">("none");
  const [copyFailed, setCopyFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function copyTag() {
    try {
      await navigator.clipboard.writeText(post.playerTag);
      setCopyFailed(false);
    } catch {
      // Если буфер обмена недоступен — покажем тег, чтобы скопировать вручную.
      setCopyFailed(true);
    }
    setPanel("copied");
  }

  async function run(path: string, body: object, onSuccess: () => void) {
    setBusy(true);
    setMessage(null);
    const result = await apiPost(path, { postId: post.id, ...body });
    setBusy(false);
    if (result.ok) onSuccess();
    else setMessage(result.error);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="secondary" className="bg-tg-bg! whitespace-nowrap px-3 py-2 text-sm" onClick={copyTag}>
          📋 Скопировать тег
        </Button>
        <Button
          className="px-2 py-2 text-sm"
          disabled={busy || responded}
          onClick={() => run("/api/lfg/respond", {}, () => setResponded(true))}
        >
          {responded ? "✅ Ты в деле" : "🤝 Я в деле"}
        </Button>
      </div>

      {panel === "copied" && (
        <p className="rounded-xl bg-tg-bg px-3 py-2 text-sm">
          {copyFailed ? (
            <>
              Тег: <b className="select-all">{post.playerTag}</b> — скопируй его вручную.{" "}
            </>
          ) : (
            <>Тег {post.playerTag} скопирован! </>
          )}
          В игре открой <b>Друзья → Добавить друга</b> и вставь тег.
        </p>
      )}

      {panel === "report" && !reported && (
        <div className="flex flex-col gap-2 rounded-xl bg-tg-bg p-3">
          <p className="text-sm font-semibold">Что не так с заявкой?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                disabled={busy}
                onClick={() =>
                  run("/api/lfg/report", { reason: r.value }, () => {
                    setReported(true);
                    setPanel("none");
                  })
                }
                className="rounded-full bg-tg-secondary-bg px-3 py-1.5 text-sm font-semibold"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === "hide" && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-tg-bg p-3 text-sm">
          <span>Больше не показывать заявки этого игрока?</span>
          <div className="flex shrink-0 gap-3 font-semibold">
            <button disabled={busy} className="text-red-500" onClick={() => run("/api/lfg/hide", {}, onHidden)}>
              Скрыть
            </button>
            <button className="text-tg-hint" onClick={() => setPanel("none")}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-red-500">{message}</p>}

      <div className="flex justify-center gap-6 text-xs font-semibold text-tg-hint">
        {reported ? (
          <span>✓ Жалоба отправлена, спасибо!</span>
        ) : (
          <button onClick={() => setPanel(panel === "report" ? "none" : "report")}>⚠️ Пожаловаться</button>
        )}
        <button onClick={() => setPanel(panel === "hide" ? "none" : "hide")}>🙈 Скрыть игрока</button>
      </div>
    </div>
  );
}
