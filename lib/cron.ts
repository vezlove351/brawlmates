import { timingSafeEqual } from "node:crypto";

// Vercel присылает "Authorization: Bearer <CRON_SECRET>" — так мы знаем, что это наш крон.
export function isFromVercelCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
