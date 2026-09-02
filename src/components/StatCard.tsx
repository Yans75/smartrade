import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <div className="glass glass-hover p-4">
      <div className="flex items-center justify-between">
        <span className="label-mono">{label}</span>
        <Icon className="h-3.5 w-3.5 text-brand-text" />
      </div>
      <p
        className="mt-2 font-mono text-2xl font-semibold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {hint && <p className="mt-1 font-mono text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
