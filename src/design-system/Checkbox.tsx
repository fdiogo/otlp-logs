"use client";

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm select-none ${className ?? ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="border-panel-border accent-foreground h-4 w-4 rounded-sm border"
      />
      <span>{label}</span>
    </label>
  );
}
