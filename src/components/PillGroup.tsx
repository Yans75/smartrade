import { cn } from "@/lib/utils";

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-full bg-muted p-1 backdrop-blur-xl",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-wide uppercase transition-all duration-200",
            value === opt.id
              ? "bg-brand/25 text-brand-text"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
