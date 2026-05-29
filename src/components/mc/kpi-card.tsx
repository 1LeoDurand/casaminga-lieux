import { Card } from "@/components/ui/card";

type Accent = "coral" | "mint" | "golden" | "turquoise";

const ACCENT_BG: Record<Accent, string> = {
  coral: "bg-peach-pale text-coral-dark",
  mint: "bg-mint/15 text-[#15803d]",
  golden: "bg-golden/20 text-[#92400e]",
  turquoise: "bg-turquoise/20 text-[#0369a1]",
};

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "coral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: Accent;
}) {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon ? (
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${ACCENT_BG[accent]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="font-heading text-3xl font-bold tracking-tight text-foreground">
        {value}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
