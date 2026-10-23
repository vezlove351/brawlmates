import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  battles,
  hiddenUsers,
  playerProfiles,
  privacySettings,
  trophyHistory,
  users,
} from "./db/schema";

// Telegram-контакт пользователя, если он сам разрешил его показывать.
export async function getAllowedContact(userId: number): Promise<string | null> {
  const [row] = await getDb()
    .select({ show: privacySettings.showTelegramContact, username: privacySettings.telegramUsername })
    .from(privacySettings)
    .where(eq(privacySettings.userId, userId));
  return row?.show && row.username ? row.username : null;
}

// Настройки для экрана: показ контакта и список скрытых игроков.
export async function getSettings(userId: number) {
  const db = getDb();
  const [privacy] = await db.select().from(privacySettings).where(eq(privacySettings.userId, userId));

  // Скрытых показываем по игровому нику и тегу — никаких данных Telegram.
  const hidden = await db
    .select({ tag: users.playerTag, profile: playerProfiles.data })
    .from(hiddenUsers)
    .innerJoin(users, eq(users.id, hiddenUsers.hiddenUserId))
    .leftJoin(playerProfiles, eq(playerProfiles.tag, users.playerTag))
    .where(eq(hiddenUsers.userId, userId));

  return {
    showTelegramContact: privacy?.showTelegramContact ?? false,
    hiddenPlayers: hidden
      .filter((h): h is typeof h & { tag: string } => h.tag !== null)
      .map((h) => ({ tag: h.tag, name: h.profile?.name ?? h.tag })),
  };
}

// Включить/выключить показ Telegram. @username храним только пока показ включён.
export async function setShowContact(userId: number, show: boolean, username: string | undefined) {
  const telegramUsername = show ? (username ?? null) : null;
  await getDb()
    .insert(privacySettings)
    .values({ userId, showTelegramContact: show, telegramUsername })
    .onConflictDoUpdate({
      target: privacySettings.userId,
      set: { showTelegramContact: show, telegramUsername, updatedAt: new Date() },
    });
}

// При каждом входе обновляем @username (его могли сменить), если показ включён.
export async function refreshUsername(userId: number, username: string | undefined) {
  await getDb()
    .update(privacySettings)
    .set({ telegramUsername: username ?? null })
    .where(and(eq(privacySettings.userId, userId), eq(privacySettings.showTelegramContact, true)));
}

// «Показать снова» скрытого игрока.
export async function unhidePlayer(userId: number, tag: string) {
  const db = getDb();
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.playerTag, tag));
  if (!target) return;
  await db
    .delete(hiddenUsers)
    .where(and(eq(hiddenUsers.userId, userId), eq(hiddenUsers.hiddenUserId, target.id)));
}

// Удаление аккаунта и всех данных одной кнопкой.
// Заявки, отклики, жалобы, скрытия и настройки удаляются вместе с пользователем (каскад),
// а кеш профиля, бои и история трофеев привязаны к тегу — их удаляем отдельно.
export async function deleteAccount(userId: number) {
  const db = getDb();
  const [user] = await db.select({ tag: users.playerTag }).from(users).where(eq(users.id, userId));
  if (!user) return;

  const tag = user.tag;
  if (tag) {
    await db.batch([
      db.delete(users).where(eq(users.id, userId)),
      db.delete(battles).where(eq(battles.playerTag, tag)),
      db.delete(trophyHistory).where(eq(trophyHistory.playerTag, tag)),
      db.delete(playerProfiles).where(eq(playerProfiles.tag, tag)),
    ]);
  } else {
    await db.delete(users).where(eq(users.id, userId));
  }
}
