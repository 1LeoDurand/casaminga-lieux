/**
 * ModuleEmptyState — état vide unifié pour tous les modules.
 * Reprend le pattern mc-empty existant + ajoute CTA + lien aide.
 *
 * Inspiré de Yapla/AssoConnect : illustration + texte de valeur + action + aide.
 */

interface ModuleEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  sub: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tip?: string;
}

export function ModuleEmptyState({
  icon,
  title,
  sub,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tip,
}: ModuleEmptyStateProps) {
  return (
    <div className="mc-card">
      <div className="mc-empty">
        <span className="mc-empty-ic">{icon}</span>
        <div className="mc-empty-title">{title}</div>
        <p className="mc-empty-sub">{sub}</p>

        {(actionLabel || secondaryLabel) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                className="mc-btn mc-btn-sm"
              >
                {actionLabel}
              </button>
            )}
            {secondaryLabel && onSecondary && (
              <button
                type="button"
                onClick={onSecondary}
                className="mc-btn mc-btn-sm mc-btn-outline"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        )}

        {tip && (
          <p className="mt-3 text-[11px] text-warmgray/70 max-w-xs">
            💡 {tip}
          </p>
        )}
      </div>
    </div>
  );
}
