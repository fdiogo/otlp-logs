"use client";

import type { LucideIcon } from "lucide-react";

export function ToggleGroup<Value extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: Value;
  onChange: (value: Value) => void;
  options: { value: Value; label: string; icon: LucideIcon }[];
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex items-center gap-0.5 rounded-md bg-panel-border-subtle p-0.5 ${className ?? ""}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium transition-colors ${
            option.value === value
              ? "bg-panel text-foreground shadow-sm"
              : "text-panel-muted hover:text-foreground"
          }`}
        >
          <option.icon className="h-4 w-4" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
