"use client";

import { useState } from "react";

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Sélecteur de fichiers avec un contrôle de confort (nombre, poids) avant
 * l'envoi. Le serveur refait tous les contrôles : celui-ci n'évite qu'un long
 * envoi qui finirait refusé.
 */
export function FilesInput({ className }: { className: string }) {
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div>
      <input
        type="file"
        name="files"
        multiple
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className={className}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          if (files.length > MAX_FILES) {
            setProblem(`Dix photos au plus par envoi (vous en avez choisi ${files.length}).`);
          } else if (files.some((f) => f.size > MAX_BYTES)) {
            setProblem("Chaque photo doit peser 10 Mo au plus.");
          } else {
            setProblem(null);
          }
        }}
      />
      {problem && (
        <p role="alert" className="mt-2 text-[13px] text-[#B4472A]">
          {problem}
        </p>
      )}
    </div>
  );
}
