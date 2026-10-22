import { timingSafeEqual } from "node:crypto";
import { webhookCallback } from "grammy";
import { getBot, getWebhookSecret } from "@/lib/bot";

function hasValidSecret(request: Request): boolean {
  const received = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(getWebhookSecret());
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Сюда Telegram присылает все сообщения боту (вебхук).
export async function POST(request: Request): Promise<Response> {
  // Сначала убеждаемся, что запрос пришёл от Telegram (секрет задаётся в scripts/set-webhook.mjs).
  if (!hasValidSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const handle = webhookCallback(getBot(), "std/http");
  return handle(request);
}
