// 12450 → "12 450"
export function formatNumber(n: number): string {
  return n.toLocaleString("ru-RU");
}

// Русское склонение: plural(21, ["бой", "боя", "боёв"]) → "бой", 3 → "боя", 11 → "боёв".
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
