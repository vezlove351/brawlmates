"use client";

import { Greeting } from "./Greeting";
import { LinkAccount } from "./LinkAccount";
import { PlayerView } from "./PlayerView";
import { useAuth } from "./useAuth";

export function MainScreen() {
  const { auth, updateUser } = useAuth();

  if (auth.status === "loading") {
    return <Centered><p className="text-tg-hint">Загрузка…</p></Centered>;
  }

  if (auth.status === "outside") {
    return (
      <Centered>
        <h1 className="text-2xl font-bold">Brawlmates</h1>
        <p className="text-tg-hint">Открой приложение через бота в Telegram.</p>
      </Centered>
    );
  }

  if (auth.status === "error") {
    return <Centered><p className="text-tg-hint">{auth.message}</p></Centered>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <Greeting firstName={auth.user.firstName} createdAt={auth.user.createdAt} />
      {auth.user.playerTag ? (
        <PlayerView playerTag={auth.user.playerTag} />
      ) : (
        <LinkAccount onLinked={(playerTag) => updateUser({ playerTag })} />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      {children}
    </div>
  );
}
