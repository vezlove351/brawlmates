// Готовые варианты для заявок LFG. Общие для формы (браузер) и проверки (сервер).

export const LFG_POST_TTL_MS = 2 * 60 * 60 * 1000; // заявка живёт 2 часа
export const LFG_DAILY_POST_LIMIT = 5; // не больше 5 заявок в сутки
export const LFG_HOURLY_RESPONSE_LIMIT = 20; // не больше 20 откликов в час
export const LFG_COMMENT_MAX = 80;
export const LFG_MAX_BRAWLERS = 3;

export interface LfgMode {
  id: string;
  label: string;
  emoji: string;
  // Сколько тиммейтов максимум можно искать в этом режиме.
  maxPlayers: number;
}

export const LFG_MODES: LfgMode[] = [
  { id: "ranked", label: "Рейтинговый бой", emoji: "🏅", maxPlayers: 2 },
  { id: "gemGrab", label: "Захват кристаллов", emoji: "💎", maxPlayers: 2 },
  { id: "brawlBall", label: "Бравлбол", emoji: "⚽", maxPlayers: 2 },
  { id: "heist", label: "Ограбление", emoji: "💰", maxPlayers: 2 },
  { id: "bounty", label: "Награда за поимку", emoji: "⭐", maxPlayers: 2 },
  { id: "knockout", label: "Нокаут", emoji: "🥊", maxPlayers: 2 },
  { id: "hotZone", label: "Горячая зона", emoji: "🔥", maxPlayers: 2 },
  { id: "duoShowdown", label: "Парное столкновение", emoji: "👥", maxPlayers: 1 },
  { id: "any", label: "Любой режим", emoji: "🎲", maxPlayers: 2 },
];

export interface TrophyBracket {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const TROPHY_BRACKETS: TrophyBracket[] = [
  { id: "any", label: "Любые", min: 0, max: 1_000_000 },
  { id: "0-5k", label: "до 5 000", min: 0, max: 5_000 },
  { id: "5-15k", label: "5–15 тыс.", min: 5_000, max: 15_000 },
  { id: "15-30k", label: "15–30 тыс.", min: 15_000, max: 30_000 },
  { id: "30-50k", label: "30–50 тыс.", min: 30_000, max: 50_000 },
  { id: "50-80k", label: "50–80 тыс.", min: 50_000, max: 80_000 },
  { id: "80k+", label: "80 тыс.+", min: 80_000, max: 1_000_000 },
];

export const LFG_LANGUAGES = [
  { id: "ru", label: "🇷🇺 Русский" },
  { id: "uk", label: "🇺🇦 Українська" },
  { id: "en", label: "🇬🇧 English" },
];

export const findMode = (id: string) => LFG_MODES.find((m) => m.id === id);
export const findBracket = (id: string) => TROPHY_BRACKETS.find((b) => b.id === id);
export const findLanguage = (id: string) => LFG_LANGUAGES.find((l) => l.id === id);

// Диапазон, в который попадают трофеи игрока, — чтобы подставить в форму по умолчанию.
export function bracketFor(trophies: number): TrophyBracket {
  return (
    TROPHY_BRACKETS.find((b) => b.id !== "any" && trophies >= b.min && trophies < b.max) ??
    TROPHY_BRACKETS[0]
  );
}

// Подпись диапазона по сохранённым min/max (в заявке хранятся числа).
export function bracketLabel(min: number, max: number): string {
  return TROPHY_BRACKETS.find((b) => b.min === min && b.max === max)?.label ?? `${min}–${max}`;
}

// Что присылает форма.
export interface LfgPostInput {
  mode: string;
  brawlerIds: number[];
  bracket: string;
  language: string;
  playersNeeded: number;
  comment: string;
}
