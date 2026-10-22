"use client";

import { useState, type PointerEvent } from "react";
import { formatNumber } from "@/lib/format";

export interface TrophyPoint {
  day: string; // "2026-10-22"
  trophies: number;
}

// Размеры области рисования (SVG растягивается по ширине экрана).
const W = 320;
const H = 150;
const PAD = { top: 12, right: 12, bottom: 22, left: 12 };

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

// Линейный график трофеев по дням. Нажми/наведи — увидишь значение за день.
export function TrophyChart({ points }: { points: TrophyPoint[] }) {
  const [selected, setSelected] = useState(points.length - 1);

  const values = points.map((p) => p.trophies);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Если трофеи не менялись, рисуем ровную линию посередине.
  const span = max - min || 1;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    max === min ? H / 2 : PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.trophies)}`).join(" ");

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relX = ((event.clientX - rect.left) / rect.width) * W;
    const step = (W - PAD.left - PAD.right) / (points.length - 1);
    const index = Math.round((relX - PAD.left) / step);
    setSelected(Math.max(0, Math.min(points.length - 1, index)));
  }

  const point = points[selected];
  const total = points[points.length - 1].trophies - points[0].trophies;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-tg-secondary-bg p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-tg-hint">{dayLabel(point.day)}</p>
          <p className="text-xl font-black">🏆 {formatNumber(point.trophies)}</p>
        </div>
        <p className="text-right text-xs text-tg-hint">
          За {points.length} дн.:{" "}
          <span className={`font-bold ${total >= 0 ? "text-green-600" : "text-red-500"}`}>
            {total > 0 ? "+" : ""}
            {formatNumber(total)}
          </span>
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`График трофеев: от ${formatNumber(points[0].trophies)} до ${formatNumber(
          points[points.length - 1].trophies,
        )}`}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
      >
        {/* Неяркая сетка: верх, середина, низ */}
        {[0, 0.5, 1].map((t) => {
          const gy = PAD.top + t * (H - PAD.top - PAD.bottom);
          return (
            <line
              key={t}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={gy}
              y2={gy}
              className="stroke-tg-hint"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          );
        })}

        {/* Вертикальная линия на выбранном дне */}
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1={PAD.top}
          y2={H - PAD.bottom}
          className="stroke-tg-hint"
          strokeOpacity={0.5}
          strokeDasharray="3 3"
        />

        <path d={path} fill="none" className="stroke-tg-button" strokeWidth={2} strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={p.day}
            cx={x(i)}
            cy={y(p.trophies)}
            r={i === selected ? 5 : 4}
            className="fill-tg-button stroke-tg-secondary-bg"
            strokeWidth={2}
          />
        ))}

        {/* Подписи первого и последнего дня */}
        <text x={PAD.left} y={H - 4} className="fill-tg-hint text-[10px]">
          {dayLabel(points[0].day)}
        </text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" className="fill-tg-hint text-[10px]">
          {dayLabel(points[points.length - 1].day)}
        </text>
      </svg>
    </div>
  );
}
