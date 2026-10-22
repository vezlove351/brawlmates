"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { init, initData, miniApp, themeParams, viewport } from "@telegram-apps/sdk-react";

// "loading" — ещё не знаем (серверный рендер), "ready" — открыто внутри Telegram,
// "outside" — страницу открыли в обычном браузере.
type TelegramStatus = "loading" | "ready" | "outside";

let status: TelegramStatus | undefined;

// Подключаемся к Telegram один раз за жизнь страницы.
function initTelegram(): TelegramStatus {
  if (status) return status;

  try {
    // init() бросает ошибку, если страница открыта не в Telegram.
    init();
  } catch {
    status = "outside";
    return status;
  }

  // Данные пользователя из Telegram (имя и т.д.). Это НЕпроверенные данные —
  // для приветствия годится, а всё важное сервер будет проверять по подписи.
  initData.restore();

  // Цвета темы Telegram → CSS-переменные вида --tg-theme-bg-color.
  themeParams.mountSync.ifAvailable();
  themeParams.bindCssVars.ifAvailable();

  // Цвет шапки и фона окна Telegram подстраиваем под тему.
  miniApp.mountSync.ifAvailable();
  miniApp.bindCssVars.ifAvailable();

  // Раскрываем приложение на всю высоту экрана.
  viewport.expand.ifAvailable();

  // Сообщаем Telegram, что приложение готово — убирается заставка загрузки.
  miniApp.ready.ifAvailable();

  status = "ready";
  return status;
}

// Статус не меняется после запуска, поэтому подписка пустая.
const subscribe = () => () => {};

const TelegramStatusContext = createContext<TelegramStatus>("loading");

export function useTelegramStatus(): TelegramStatus {
  return useContext(TelegramStatusContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  // На сервере — "loading", в браузере — результат подключения к Telegram.
  const current = useSyncExternalStore(subscribe, initTelegram, () => "loading" as const);

  return (
    <TelegramStatusContext.Provider value={current}>{children}</TelegramStatusContext.Provider>
  );
}
