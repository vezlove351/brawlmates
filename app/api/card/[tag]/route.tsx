import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { ProfileOgCard, type OgImages } from "@/components/og/ProfileOgCard";
import {
  BrawlStarsError,
  brawlerIconUrl,
  isValidTag,
  normalizeTag,
  remoteIconUrl,
} from "@/lib/brawlstars";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getPlayerProfile } from "@/lib/profile";

// Картинка-карточка профиля для превью: /api/card/ABC123 (тег без #).
// ImageResponse — это и есть @vercel/og, встроенный в Next.js.

// Кеш на 10 минут: и в Telegram, и на CDN Vercel.
const CACHE_HEADERS = {
  "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=60",
};

// Шрифт с кириллицей (стандартный её не умеет). Загружаем один раз на сервер.
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 600 | 900 }[]> | undefined;
function loadFonts() {
  fontsPromise ??= Promise.all(
    (["600-latin", "600-cyrillic", "900-latin", "900-cyrillic"] as const).map(async (file) => ({
      // Латиница и кириллица — разные файлы; даём им разные имена, а в карточке
      // перечисляем оба (fontFamily: "Rubik, RubikCyrillic"), чтобы Satori брал нужный.
      name: file.endsWith("cyrillic") ? "RubikCyrillic" : "Rubik",
      data: await readFile(join(process.cwd(), "assets/fonts", `Rubik-${file}.ttf`)),
      weight: file.startsWith("900") ? (900 as const) : (600 as const),
    })),
  );
  return fontsPromise;
}

// Скачиваем картинку заранее и встраиваем как data:URL.
// Если CDN не ответил — карточка всё равно нарисуется, просто без этой иконки.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, ctx: RouteContext<"/api/card/[tag]">) {
  const { tag: rawTag } = await ctx.params;
  const tag = normalizeTag(decodeURIComponent(rawTag).replace(/\.png$/i, ""));
  if (!isValidTag(tag)) return new Response("Bad tag", { status: 400 });

  // Как и публичный профиль — только для тех, кто сам привязал тег в Brawlmates.
  const [owner] = await getDb().select({ id: users.id }).from(users).where(eq(users.playerTag, tag));
  if (!owner) return new Response("Not found", { status: 404 });

  let profile;
  try {
    ({ profile } = await getPlayerProfile(tag));
  } catch (err) {
    if (err instanceof BrawlStarsError) return new Response(err.message, { status: err.status });
    throw err;
  }

  const topBrawlers = [...profile.brawlers].sort((a, b) => b.trophies - a.trophies).slice(0, 3);

  const [fonts, playerIcon, ...brawlerIcons] = await Promise.all([
    loadFonts(),
    toDataUrl(remoteIconUrl(profile.iconId)),
    ...topBrawlers.map((b) => toDataUrl(brawlerIconUrl(b.id))),
  ]);
  const images: OgImages = {
    playerIcon,
    brawlers: Object.fromEntries(topBrawlers.map((b, i) => [b.id, brawlerIcons[i]])),
  };

  return new ImageResponse(
    <ProfileOgCard profile={profile} topBrawlers={topBrawlers} images={images} />,
    { width: 1200, height: 630, fonts, emoji: "twemoji", headers: CACHE_HEADERS },
  );
}
