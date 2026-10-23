"use client";

import { useCallback, useEffect, useState } from "react";
import { openTelegramLink } from "@telegram-apps/sdk-react";
import { apiPost } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { Button } from "./Button";
import { PlayerAvatar } from "./PlayerAvatar";
import { TeamGame, type TeamGameData } from "./TeamGame";
import { TeamStats } from "./TeamStats";

// Набор эмблем (ключи совпадают с lib/teams.ts на сервере).
const EMBLEMS: [string, string][] = [
  ["fire", "🔥"], ["bolt", "⚡"], ["dragon", "🐉"], ["lion", "🦁"], ["gem", "💎"], ["rocket", "🚀"],
  ["crown", "👑"], ["star", "🌟"], ["target", "🎯"], ["shield", "🛡️"], ["wolf", "🐺"], ["robot", "🤖"],
  ["ghost", "👻"], ["alien", "👽"], ["ninja", "🥷"], ["trophy", "🏆"],
];

interface Member {
  tag: string;
  name: string;
  trophies: number | null;
  iconId: number | null;
  role: "captain" | "member";
  isMe: boolean;
}

interface TeamData {
  team: {
    name: string;
    emblem: string;
    myRole: "captain" | "member";
    members: Member[];
    maxMembers: number;
  } | null;
  candidates?: { tag: string; name: string; trophies: number | null }[];
  game?: TeamGameData | null;
  invites: { code: string; name: string; emblem: string }[];
}

interface InviteInfo {
  valid: boolean;
  error?: string;
  team?: { name: string; emblem: string; members: { name: string; role: string }[]; full: boolean };
  alreadyInTeam?: boolean;
}

// Экран «Моя команда».
export function TeamScreen({
  inviteCode,
  onOpenProfile,
}: {
  inviteCode: string | null; // открыли по ссылке-приглашению
  onOpenProfile: (tag: string) => void;
}) {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingCode, setPendingCode] = useState(inviteCode);

  const reload = useCallback(async () => {
    const result = await apiPost<TeamData>("/api/team");
    if (result.ok) setData(result.data);
    else setError(result.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiPost<TeamData>("/api/team").then((result) => {
      if (cancelled) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Выполнить действие и перечитать экран.
  async function act(path: string, body: object = {}, success?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await apiPost(path, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    if (success) setNotice(success);
    await reload();
    return true;
  }

  async function shareInviteLink() {
    setBusy(true);
    setError(null);
    const result = await apiPost<{ link: string; teamName: string }>("/api/team/invite-link");
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const text = `Вступай в мою команду «${result.data.teamName}» в Brawlmates! Ссылка действует 24 часа и только для одного игрока.`;
    openTelegramLink.ifAvailable(
      `https://t.me/share/url?url=${encodeURIComponent(result.data.link)}&text=${encodeURIComponent(text)}`,
    );
  }

  if (!data) return error ? <Note>{error}</Note> : <div className="h-64 animate-pulse rounded-2xl bg-tg-secondary-bg" />;

  return (
    <div className="flex flex-col gap-4">
      {pendingCode && (
        <InviteCard
          code={pendingCode}
          busy={busy}
          onJoin={async () => {
            if (await act("/api/team/join", { code: pendingCode }, "Добро пожаловать в команду! 🎉")) setPendingCode(null);
          }}
          onClose={() => setPendingCode(null)}
        />
      )}

      {notice && <p className="rounded-2xl bg-tg-button px-4 py-3 text-center font-semibold text-tg-button-text">{notice}</p>}
      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {data.team ? (
        <MyTeam data={data} busy={busy} act={act} onShareLink={shareInviteLink} onOpenProfile={onOpenProfile} />
      ) : (
        <>
          {data.invites.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold text-tg-hint">Тебя зовут в команду</h2>
              {data.invites.map((inv) => (
                <div key={inv.code} className="flex items-center gap-3 rounded-2xl bg-tg-secondary-bg p-3">
                  <span className="text-3xl">{inv.emblem}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{inv.name}</span>
                  <Button className="w-auto! shrink-0 px-4 py-2 text-sm" disabled={busy} onClick={() => setPendingCode(inv.code)}>
                    Открыть
                  </Button>
                </div>
              ))}
            </section>
          )}
          <CreateTeamForm busy={busy} onCreate={(name, emblem) => act("/api/team/create", { name, emblem }, "Команда создана! Теперь позови друзей 👇")} />
        </>
      )}
    </div>
  );
}

function MyTeam({
  data,
  busy,
  act,
  onShareLink,
  onOpenProfile,
}: {
  data: TeamData;
  busy: boolean;
  act: (path: string, body?: object, success?: string) => Promise<boolean>;
  onShareLink: () => void;
  onOpenProfile: (tag: string) => void;
}) {
  const team = data.team!;
  const [confirm, setConfirm] = useState<string | null>(null); // тег для исключения или "leave"
  const isCaptain = team.myRole === "captain";
  const hasRoom = team.members.length < team.maxMembers;
  const others = team.members.filter((m) => !m.isMe);

  return (
    <>
      <header className="flex flex-col items-center gap-1 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-fuchsia-700 p-5 text-white shadow-lg">
        <span className="text-6xl drop-shadow">{team.emblem}</span>
        <h1 className="text-2xl font-black drop-shadow-sm">{team.name}</h1>
        <p className="text-sm text-white/85">
          {team.members.length} из {team.maxMembers} игроков
        </p>
      </header>

      <section className="flex flex-col gap-2">
        {team.members.map((m) => (
          <div key={m.tag} className="flex items-center gap-3 rounded-2xl bg-tg-secondary-bg p-3">
            <button className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={m.isMe} onClick={() => onOpenProfile(m.tag)}>
              <PlayerAvatar iconId={m.iconId} />
              <span className="min-w-0">
                <span className="block truncate font-bold">
                  {m.role === "captain" && "👑 "}
                  {m.name}
                  {m.isMe && " (ты)"}
                </span>
                <span className="block text-sm text-tg-hint">
                  {m.trophies !== null ? `🏆 ${formatNumber(m.trophies)}` : m.tag}
                  {m.role === "captain" && " · капитан"}
                </span>
              </span>
            </button>
            {isCaptain && !m.isMe &&
              (confirm === m.tag ? (
                <span className="flex shrink-0 gap-2 text-sm font-semibold">
                  <button className="text-red-500" disabled={busy} onClick={() => act("/api/team/kick", { tag: m.tag })}>
                    Исключить
                  </button>
                  <button className="text-tg-hint" onClick={() => setConfirm(null)}>
                    Нет
                  </button>
                </span>
              ) : (
                <button className="shrink-0 text-sm text-tg-hint" onClick={() => setConfirm(m.tag)}>
                  ✕
                </button>
              ))}
          </div>
        ))}
      </section>

      {team.members.length >= 2 && (
        <TeamGame game={data.game ?? null} isCaptain={isCaptain} busy={busy} act={act} />
      )}

      <TeamStats teamSize={team.members.length} />

      {hasRoom && (
        <section className="flex flex-col gap-2 rounded-2xl bg-tg-secondary-bg p-4">
          <h2 className="font-semibold">Позвать в команду</h2>
          {data.candidates && data.candidates.length > 0 ? (
            data.candidates.map((c) => (
              <div key={c.tag} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                  {c.name} {c.trophies !== null && <span className="text-tg-hint">🏆 {formatNumber(c.trophies)}</span>}
                </span>
                <button
                  className="shrink-0 text-sm font-semibold text-tg-link"
                  disabled={busy}
                  onClick={() => act("/api/team/invite-friend", { tag: c.tag }, `Приглашение отправлено — ${c.name} получит сообщение от бота`)}
                >
                  Пригласить
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-tg-hint">Свободных друзей нет — все уже в командах или друзей пока нет.</p>
          )}
          <Button variant="secondary" className="mt-1 bg-tg-bg! py-2 text-sm" disabled={busy} onClick={onShareLink}>
            🔗 Отправить ссылку-приглашение
          </Button>
          <p className="text-xs text-tg-hint">Ссылка действует 24 часа и срабатывает для одного игрока.</p>
        </section>
      )}

      {confirm === "leave" ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-tg-secondary-bg p-4 text-center">
          <p className="text-sm">
            {others.length === 0
              ? "Ты последний в команде — она будет удалена."
              : isCaptain
                ? `Капитаном станет ${others[0].name}.`
                : "Точно выйти из команды?"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="bg-red-600! py-2 text-sm text-white!" disabled={busy} onClick={() => act("/api/team/leave")}>
              Выйти
            </Button>
            <Button variant="secondary" className="bg-tg-bg! py-2 text-sm" onClick={() => setConfirm(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <button className="text-sm font-semibold text-red-500" onClick={() => setConfirm("leave")}>
          Выйти из команды
        </button>
      )}
    </>
  );
}

function CreateTeamForm({ busy, onCreate }: { busy: boolean; onCreate: (name: string, emblem: string) => void }) {
  const [name, setName] = useState("");
  const [emblem, setEmblem] = useState("fire");
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-tg-secondary-bg p-4">
      <h2 className="text-xl font-bold">Создать команду</h2>
      <p className="text-sm text-tg-hint">До 3 игроков. Ты станешь капитаном и сможешь позвать друзей.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={24}
        placeholder="Название команды"
        className="rounded-xl border border-tg-hint/30 bg-tg-bg px-3 py-2.5 outline-none focus:border-tg-button"
      />
      <p className="text-sm font-semibold text-tg-hint">Эмблема</p>
      <div className="grid grid-cols-8 gap-1.5">
        {EMBLEMS.map(([key, emoji]) => (
          <button
            key={key}
            type="button"
            onClick={() => setEmblem(key)}
            className={`aspect-square rounded-xl text-2xl ${emblem === key ? "bg-tg-button" : "bg-tg-bg"}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <Button disabled={busy || name.trim().length < 2} onClick={() => onCreate(name, emblem)}>
        Создать команду
      </Button>
    </section>
  );
}

// Карточка приглашения: что за команда и кнопка «Вступить».
function InviteCard({
  code,
  busy,
  onJoin,
  onClose,
}: {
  code: string;
  busy: boolean;
  onJoin: () => void;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiPost<InviteInfo>("/api/team/invite-info", { code }).then((result) => {
      if (!cancelled) setInfo(result.ok ? result.data : { valid: false, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!info) return <div className="h-40 animate-pulse rounded-2xl bg-tg-secondary-bg" />;

  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-tg-secondary-bg p-5 text-center ring-2 ring-tg-button">
      {info.valid && info.team ? (
        <>
          <p className="text-sm text-tg-hint">Приглашение в команду</p>
          <span className="text-5xl">{info.team.emblem}</span>
          <h2 className="text-xl font-black">{info.team.name}</h2>
          <p className="text-sm text-tg-hint">
            {info.team.members.map((m) => (m.role === "captain" ? `👑 ${m.name}` : m.name)).join(" · ")}
          </p>
          {info.alreadyInTeam ? (
            <p className="text-sm">Ты уже в команде. Чтобы вступить в эту — сначала выйди из своей.</p>
          ) : info.team.full ? (
            <p className="text-sm">В этой команде уже нет мест.</p>
          ) : (
            <Button disabled={busy} onClick={onJoin}>
              Вступить в команду
            </Button>
          )}
        </>
      ) : (
        <p className="font-semibold">{info.error}</p>
      )}
      <button className="text-sm text-tg-hint" onClick={onClose}>
        Не сейчас
      </button>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-tg-secondary-bg p-4 text-center text-sm text-tg-hint">{children}</div>;
}
