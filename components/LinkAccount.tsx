"use client";

import { useState } from "react";
import { IconCheck, type LinkChallenge } from "./IconCheck";
import { TagForm } from "./TagForm";

// Привязка аккаунта Brawl Stars в два шага: ввод тега → смена иконки.
export function LinkAccount({ onLinked }: { onLinked: (playerTag: string) => void }) {
  const [challenge, setChallenge] = useState<LinkChallenge | null>(null);

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-tg-secondary-bg p-4">
      <h2 className="text-xl font-bold">Привяжи аккаунт Brawl Stars</h2>
      {challenge ? (
        <IconCheck
          challenge={challenge}
          onLinked={onLinked}
          onRestart={() => setChallenge(null)}
        />
      ) : (
        <TagForm onStarted={setChallenge} />
      )}
    </section>
  );
}
