"use client";

import { useId, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/**
 * Tableau kanban générique — présentation et déplacement uniquement.
 *
 * Il ne connaît ni la provenance des données ni leur forme : l'appelant fournit
 * les colonnes, les éléments, et le rendu d'une carte. C'est ce qui permet de le
 * monter deux fois — sur la feuille de route plateforme (`platform_tasks`) et sur
 * les tâches d'une organisation (`tasks`) — sans dupliquer la logique de glisser-déposer.
 *
 * Déplacement ENTRE colonnes seulement : aucune des deux tables ne porte de colonne
 * d'ordre, un réordonnancement manuel ne pourrait donc pas être enregistré. L'ordre
 * affiché est celui que l'appelant a donné à `items`.
 */

export interface BoardColumn {
  id: string;
  label: string;
  /** Pastille de couleur du titre (hex). */
  dot?: string;
  /** Phrase affichée quand la colonne est vide. */
  empty?: string;
}

interface TaskBoardProps<T> {
  columns: BoardColumn[];
  items: T[];
  getId: (item: T) => string;
  getColumnId: (item: T) => string;
  /** Appelé quand une carte est lâchée sur une autre colonne. */
  onMove: (id: string, toColumnId: string) => void;
  renderCard: (item: T) => React.ReactNode;
  onCardClick?: (id: string) => void;
  /** Bloque le glisser-déposer pendant un enregistrement. */
  disabled?: boolean;
}

export function TaskBoard<T>({
  columns, items, getId, getColumnId, onMove, renderCard, onCardClick, disabled = false,
}: TaskBoardProps<T>) {
  const [dragging, setDragging] = useState<string | null>(null);
  const dndId = useId();

  // La souris exige 6 px de mouvement avant de démarrer un glisser : sans ce délai,
  // un simple clic sur la carte serait avalé et n'ouvrirait jamais le détail.
  // Au doigt, on attend 200 ms d'appui, sinon le défilement vertical devient impossible.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Espace déplace, Entrée ouvre. Par défaut dnd-kit capte les deux pour le
    // déplacement, ce qui rendrait l'ouverture d'une carte impossible au clavier.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const byColumn = useMemo(() => {
    const m = new Map<string, T[]>(columns.map((c) => [c.id, []]));
    for (const it of items) m.get(getColumnId(it))?.push(it);
    return m;
  }, [columns, items, getColumnId]);

  const draggedItem = dragging ? items.find((it) => getId(it) === dragging) ?? null : null;

  function handleStart(e: DragStartEvent) {
    setDragging(String(e.active.id));
  }

  function handleEnd(e: DragEndEvent) {
    setDragging(null);
    const overId = e.over?.id;
    if (!overId) return;
    const id = String(e.active.id);
    const to = String(overId);
    const item = items.find((it) => getId(it) === id);
    if (!item || getColumnId(item) === to) return;
    onMove(id, to);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragging(null)}
    >
      {/* Réutilise .mc-kanban du design system : grille responsive déjà réglée
          (2 colonnes sous 1100 px, 1 sous 640 px). */}
      <div
        className="mc-kanban"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            count={byColumn.get(col.id)?.length ?? 0}
            isDraggingSomething={dragging !== null}
          >
            {(byColumn.get(col.id) ?? []).map((it) => (
              <Card
                key={getId(it)}
                id={getId(it)}
                disabled={disabled}
                onClick={onCardClick ? () => onCardClick(getId(it)) : undefined}
              >
                {renderCard(it)}
              </Card>
            ))}
          </Column>
        ))}
      </div>

      {/* Carte fantôme qui suit le curseur — sans elle on déplace un trou. */}
      <DragOverlay dropAnimation={null}>
        {draggedItem ? (
          <div className="w-[260px] rotate-2 opacity-95 shadow-lg">{renderCard(draggedItem)}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ column, count, isDraggingSomething, children }: {
  column: BoardColumn;
  count: number;
  isDraggingSomething: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label} — ${count} carte${count > 1 ? "s" : ""}`}
      className="mc-kanban-col transition-colors"
      // Surlignage de la cible : sans retour visuel, on ne sait pas où on lâche.
      style={
        isOver
          ? { outline: "2px solid var(--coral)", outlineOffset: "-2px", background: "var(--peach-pale, #fdf1ea)" }
          : isDraggingSomething
            ? { borderStyle: "dashed" }
            : undefined
      }
    >
      <header className="mc-kanban-head">
        <span className="mc-kanban-title">
          {column.dot ? <span className="mc-kanban-dot" style={{ background: column.dot }} aria-hidden /> : null}
          {column.label}
        </span>
        <span className="mc-kanban-count">{count}</span>
      </header>

      {count === 0 ? (
        <div className="mc-kanban-empty">{column.empty ?? "—"}</div>
      ) : children}
    </section>
  );
}

function Card({ id, disabled, onClick, children }: {
  id: string;
  disabled: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      // La carte d'origine disparaît pendant le glisser : c'est l'overlay qui suit le curseur.
      className={isDragging ? "opacity-0" : "cursor-grab active:cursor-grabbing"}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onClick) { e.preventDefault(); onClick(); }
      }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}
