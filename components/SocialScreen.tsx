"use client";

import { useState } from "react";
import { FriendsScreen } from "./FriendsScreen";
import { Tabs } from "./Tabs";
import { TeamScreen } from "./TeamScreen";

type SocialTab = "friends" | "team";

const TABS: { value: SocialTab; label: string }[] = [
  { value: "friends", label: "Друзья" },
  { value: "team", label: "🛡️ Команда" },
];

// Раздел «Друзья»: вкладки «Друзья» и «Команда».
export function SocialScreen({
  inviteCode,
  onOpenProfile,
}: {
  inviteCode: string | null; // ссылка-приглашение в команду — сразу открываем вкладку «Команда»
  onOpenProfile: (tag: string) => void;
}) {
  const [tab, setTab] = useState<SocialTab>(inviteCode ? "team" : "friends");
  return (
    <div className="flex flex-col gap-4">
      <Tabs options={TABS} value={tab} onChange={setTab} />
      {tab === "friends" ? (
        <FriendsScreen onOpenProfile={onOpenProfile} />
      ) : (
        <TeamScreen inviteCode={inviteCode} onOpenProfile={onOpenProfile} />
      )}
    </div>
  );
}
