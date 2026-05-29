import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardTopbar({
  orgName,
  orgSlug,
  demoMode,
}: {
  orgName: string;
  orgSlug: string;
  demoMode: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-cream px-7 shadow-[0_2px_12px_rgba(255,138,101,0.08)]">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">{orgName}</div>
        <div className="text-[11px] text-muted-foreground">Espace de gestion</div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {demoMode ? (
          <span className="rounded-full border border-coral/30 bg-peach-pale px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-coral-dark">
            Démo
          </span>
        ) : null}
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/site/${orgSlug}`} target="_blank">
            Voir le site public
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
