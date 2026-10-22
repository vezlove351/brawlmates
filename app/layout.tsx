import type { Metadata, Viewport } from "next";
import { TelegramProvider } from "@/components/TelegramProvider";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brawlmates",
  description: "Профиль игрока Brawl Stars и поиск тиммейтов в Telegram",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <TelegramProvider>
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </TelegramProvider>
      </body>
    </html>
  );
}
