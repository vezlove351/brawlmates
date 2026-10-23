"use client";

import { useState } from "react";
import { brawlerIconUrl } from "@/lib/brawlstars";

interface BrawlerIconProps {
  id: number;
  name?: string;
  size: number; // размер в пикселях (для width/height)
  className?: string; // размеры и скругление в Tailwind, общие для картинки и заглушки
  lazy?: boolean;
}

// Иконка бравлера с CDN Brawlify. Новых бравлеров там иногда ещё нет —
// тогда вместо битой картинки показываем заглушку с первой буквой имени.
export function BrawlerIcon({ id, name, size, className = "", lazy = true }: BrawlerIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={name ?? "Бравлер"}
        title={name}
        className={`flex items-center justify-center bg-gradient-to-br from-amber-400 to-fuchsia-600 font-black text-white ${className}`}
        style={{ fontSize: Math.max(12, size * 0.42) }}
      >
        {name ? name.charAt(0).toUpperCase() : "🥊"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- маленькие картинки с внешнего CDN
    <img
      src={brawlerIconUrl(id)}
      alt={name ?? ""}
      width={size}
      height={size}
      loading={lazy ? "lazy" : undefined}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
