import type { Metadata } from "next";
import { AdminScreen } from "@/components/AdminScreen";

export const metadata: Metadata = { title: "Модерация — Brawlmates" };

// Страница модерации. Права проверяет сервер по ADMIN_IDS при каждом запросе.
export default function AdminPage() {
  return <AdminScreen />;
}
