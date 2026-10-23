// Страны для рейтинга (коды ISO, как в Brawl Stars API). Общий список для браузера и сервера.
// Названия берём из браузера/Node (Intl), поэтому храним только коды.
export const RANKING_COUNTRIES = [
  "RU", "UA", "BY", "KZ", "UZ", "KG", "TJ", "AM", "AZ", "GE", "MD",
  "PL", "DE", "FR", "GB", "ES", "PT", "IT", "TR", "IL", "US", "CA", "BR", "MX", "AR",
  "IN", "ID", "JP", "KR", "VN", "TH", "PH", "SA", "AE", "EG",
] as const;

export type CountryCode = (typeof RANKING_COUNTRIES)[number];

export function isRankingCountry(code: string): code is CountryCode {
  return (RANKING_COUNTRIES as readonly string[]).includes(code);
}

// Название страны по-русски: "RU" → "Россия".
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["ru"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Страна по умолчанию — по языку Telegram.
export function countryFromLanguage(languageCode: string | undefined): CountryCode {
  const byLanguage: Record<string, CountryCode> = {
    ru: "RU", uk: "UA", be: "BY", kk: "KZ", uz: "UZ", ky: "KG", hy: "AM", az: "AZ", ka: "GE",
    pl: "PL", de: "DE", fr: "FR", es: "ES", it: "IT", tr: "TR", he: "IL", pt: "PT", "pt-br": "BR",
    id: "ID", ja: "JP", ko: "KR", vi: "VN", th: "TH", ar: "SA", en: "US",
  };
  const code = (languageCode ?? "").toLowerCase();
  // Сначала точное совпадение ("pt-br"), потом основной язык ("pt").
  return byLanguage[code] ?? byLanguage[code.split("-")[0]] ?? "RU";
}
