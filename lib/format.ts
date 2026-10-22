// 12450 → "12 450"
export function formatNumber(n: number): string {
  return n.toLocaleString("ru-RU");
}
