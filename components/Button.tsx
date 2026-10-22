import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const look =
    variant === "primary"
      ? "bg-tg-button text-tg-button-text"
      : "bg-transparent text-tg-link";
  return (
    <button
      className={`w-full rounded-xl px-4 py-3 font-semibold transition-opacity disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}
