// Названия режимов по-русски. Ключи — как в API, в нижнем регистре.
const MODE_NAMES: Record<string, string> = {
  gemgrab: "Захват кристаллов",
  brawlball: "Бравлбол",
  heist: "Ограбление",
  bounty: "Награда за поимку",
  siege: "Осада",
  hotzone: "Горячая зона",
  knockout: "Нокаут",
  wipeout: "Зачистка",
  duels: "Дуэли",
  soloshowdown: "Одиночное столкновение",
  duoshowdown: "Парное столкновение",
  trioshowdown: "Тройное столкновение",
  basketbrawl: "Баскетбравл",
  volleybrawl: "Волейбравл",
  brawlhockey: "Бравл-хоккей",
  payload: "Груз",
  hunters: "Охотники",
  trophythieves: "Похитители трофеев",
  bossfight: "Бой с боссом",
  roborumble: "Битва с роботами",
  biggame: "Большая игра",
  gemgrab5v5: "Захват кристаллов 5 на 5",
  brawlball5v5: "Бравлбол 5 на 5",
  knockout5v5: "Нокаут 5 на 5",
  wipeout5v5: "Зачистка 5 на 5",
  deathmatch5v5: "Зачистка 5 на 5",
};

export function modeName(mode: string): string {
  const known = MODE_NAMES[mode.toLowerCase()];
  if (known) return known;
  // Неизвестный режим: "someNewMode" → "Some new mode"
  const words = mode.replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
