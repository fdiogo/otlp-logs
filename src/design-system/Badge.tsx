"use client";

import type { ReactNode } from "react";

const BADGE_TONE = {
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  warn: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  error: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof BADGE_TONE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]} ${className ?? ""}`}>
      {children}
    </span>
  );
}
