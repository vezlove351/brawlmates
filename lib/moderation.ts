// Простой фильтр комментариев: мат, ссылки и контакты.
// Он не идеален — поэтому у каждой заявки есть ещё и кнопка «Пожаловаться».

// Латинские буквы, похожие на русские, и цифры-заменители → русские буквы.
const LOOKALIKES: Record<string, string> = {
  a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", y: "у", k: "к", m: "м", t: "т",
  h: "н", b: "в", "0": "о", "3": "з", "6": "б", ё: "е",
};

function normalize(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[aeopcxykmthb036ё]/g, (ch) => LOOKALIKES[ch] ?? ch)
      // «х.у-й», «х*й» → склеиваем буквы, разделённые точками, дефисами, звёздочками
      .replace(/([а-я])[.\-_*]+(?=[а-я])/g, "$1")
      // «сууука» → «сука»
      .replace(/(.)\1+/g, "$1")
  );
}

// Корни матерных слов. «(^|[^а-я])» — слово должно начинаться так,
// чтобы не ловить обычные слова вроде «страхуем» или «оскорбляю».
const PROFANITY = [
  /(^|[^а-я])(на|по|ни|от|за)?ху[йеяюи]/,
  /пизд/,
  /(^|[^а-я])(за|вы|на|по|у|от|пере|до|при|раз|разъ|подъ|въ|съ)?еб(а|у|л|н|и|ы|е|о|т)/,
  /(^|[^а-я])бля/,
  /(^|[^а-я])сук[аио]/,
  /муда[кч]/,
  /(^|[^а-я])пид[оа]?р/,
  /г[ао]ндон/,
  /залуп/,
  /шлюх/,
  /дроч/,
];

// Мат по-английски проверяем по исходному тексту (без замены похожих букв).
const PROFANITY_EN = /fuck|shit|bitch|cunt|n[i1]gg|whore|porn/i;

// Ссылки, @ники, телефоны — чтобы контакты не утекали в обход настроек приватности.
const CONTACTS = [
  /https?:\/\//i,
  /www\./i,
  /t\.me|telegram\.me|discord\.(gg|com)|vk\.com|wa\.me/i,
  /@[a-z0-9_]{3,}/i,
  /\b[a-z0-9-]+\.(ru|com|net|org|io|me|gg|xyz|link|ly|su|рф|tk|app|dev)\b/i,
  /(\d[\s\-()]*){7,}/, // 7+ цифр подряд — похоже на телефон
];

export type CommentCheck = { ok: true } | { ok: false; reason: string };

export function checkComment(text: string): CommentCheck {
  if (CONTACTS.some((re) => re.test(text))) {
    return {
      ok: false,
      reason: "В комментарии нельзя оставлять ссылки, @ники и телефоны — для связи есть тег.",
    };
  }
  const normalized = normalize(text);
  if (PROFANITY_EN.test(text) || PROFANITY.some((re) => re.test(normalized))) {
    return { ok: false, reason: "Давай без грубых слов 🙂" };
  }
  return { ok: true };
}
