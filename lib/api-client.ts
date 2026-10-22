import { initData } from "@telegram-apps/sdk-react";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Запрос к нашему серверу от имени пользователя Telegram (только в браузере).
// К каждому запросу прикладываем initData — сервер проверит подпись.
export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        authorization: `tma ${initData.raw() ?? ""}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? "Что-то пошло не так. Попробуй ещё раз." };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Нет связи с сервером. Проверь интернет." };
  }
}
