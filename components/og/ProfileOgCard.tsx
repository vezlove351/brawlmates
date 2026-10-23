// Картинка-карточка профиля для превью в Telegram (1200×630).
// Рисуется через ImageResponse (Satori): поддерживается только flexbox и часть CSS,
// поэтому у каждого блока явно задан display: flex.

import type { PlayerBrawler, PlayerProfile } from "@/lib/brawlstars";
import { formatNumber } from "@/lib/format";

export interface OgImages {
  playerIcon: string | null;
  brawlers: Record<number, string | null>;
}

const titleCase = (name: string) => name.toLowerCase().replace(/(^|[\s-])\S/g, (s) => s.toUpperCase());

export function ProfileOgCard({
  profile,
  topBrawlers,
  images,
}: {
  profile: PlayerProfile;
  topBrawlers: PlayerBrawler[];
  images: OgImages;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "48px 56px",
        color: "white",
        fontFamily: "Rubik, RubikCyrillic",
        backgroundImage: "linear-gradient(135deg, #fbbf24 0%, #f97316 45%, #a21caf 100%)",
        position: "relative",
      }}
    >
      {/* Декоративные круги */}
      <div style={{ position: "absolute", right: -120, top: -120, width: 420, height: 420, borderRadius: 9999, background: "rgba(255,255,255,0.15)", display: "flex" }} />
      <div style={{ position: "absolute", left: -90, bottom: -140, width: 360, height: 360, borderRadius: 9999, background: "rgba(0,0,0,0.10)", display: "flex" }} />

      <div style={{ display: "flex", flex: 1, gap: 48 }}>
        {/* Левая колонка: игрок и трофеи */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {images.playerIcon ? (
              // eslint-disable-next-line @next/next/no-img-element -- это картинка для Satori, а не страница
              <img src={images.playerIcon} width={132} height={132} style={{ borderRadius: 28, border: "5px solid rgba(255,255,255,0.8)" }} alt="" />
            ) : (
              <div style={{ width: 132, height: 132, borderRadius: 28, background: "rgba(255,255,255,0.2)", display: "flex" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.1, display: "flex", maxWidth: 480, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {profile.name}
              </div>
              <div style={{ fontSize: 30, fontWeight: 600, opacity: 0.85, display: "flex" }}>{profile.tag}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, opacity: 0.85, display: "flex" }}>ТРОФЕИ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 124, fontWeight: 900, lineHeight: 1 }}>
              <span style={{ fontSize: 88 }}>🏆</span>
              {formatNumber(profile.trophies)}
            </div>
            <div style={{ display: "flex", marginTop: 16 }}>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 600, background: "rgba(0,0,0,0.2)", borderRadius: 9999, padding: "8px 24px" }}>
                Рекорд: {formatNumber(profile.highestTrophies)}
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка: топ-3 бравлера */}
        <div style={{ display: "flex", flexDirection: "column", width: 400, gap: 14 }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 2, opacity: 0.85, display: "flex" }}>ТОП-3 БРАВЛЕРА</div>
          {topBrawlers.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 20, background: "rgba(255,255,255,0.16)", borderRadius: 24, padding: 12 }}>
              {images.brawlers[b.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- это картинка для Satori, а не страница
                <img src={images.brawlers[b.id] ?? ""} width={96} height={96} style={{ borderRadius: 18 }} alt="" />
              ) : (
                <div style={{ width: 96, height: 96, borderRadius: 18, background: "rgba(0,0,0,0.15)", display: "flex" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 34, fontWeight: 900, display: "flex" }}>{titleCase(b.name)}</div>
                <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.9, display: "flex" }}>
                  🏆 {formatNumber(b.trophies)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Низ: логотип Brawlmates и пометка о неофициальности */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,0.22)", border: "3px solid rgba(255,255,255,0.8)", fontSize: 34 }}>
            🏆
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, display: "flex" }}>Brawlmates</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, opacity: 0.75, display: "flex" }}>
          Неофициальный фан-проект, не одобрен Supercell
        </div>
      </div>
    </div>
  );
}
