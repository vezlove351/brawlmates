"use client";

import { useState } from "react";
import { iconUrl, remoteIconUrl } from "@/lib/brawlstars";

// Иконка профиля игрока с CDN Brawlify; если не загрузилась — базовая иконка.
export function PlayerAvatar({ iconId, size = 44 }: { iconId: number | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- иконка профиля с CDN Brawlify
    <img
      src={iconId && !failed ? remoteIconUrl(iconId) : iconUrl(28000000)}
      onError={() => setFailed(true)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-xl"
      style={{ width: size, height: size }}
    />
  );
}
