"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "public-assets";
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

/**
 * Upload d'une image vers Supabase Storage (bucket public-assets/{orgId}/...).
 * Retourne l'URL publique via onUploaded. Aperçu intégré + suppression.
 */
export function ImageUploader({
  orgId,
  value,
  onUploaded,
  label,
  aspect = "16/9",
}: {
  orgId: string;
  value: string | null;
  onUploaded: (url: string | null) => void;
  label: string;
  aspect?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté. Choisissez une image (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Image trop lourde (5 Mo maximum). Compressez-la avant.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        console.error("upload:", error);
        toast.error("Échec de l'envoi de l'image. Réessayez.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUploaded(data.publicUrl);
      toast.success("Image ajoutée ✓");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-ink">{label}</label>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border" style={{ aspectRatio: aspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="size-full object-cover" />
          <button
            type="button"
            onClick={() => onUploaded(null)}
            className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
            title="Retirer l'image"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-peach bg-[#FFF8F5] px-4 py-8 text-center transition hover:border-coral disabled:opacity-60"
          style={{ aspectRatio: aspect }}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-coral" />
          ) : (
            <Upload className="size-6 text-coral" />
          )}
          <span className="text-[13px] font-semibold text-ink">
            {uploading ? "Envoi…" : "Ajouter une image"}
          </span>
          <span className="text-[11px] text-warmgray">JPG, PNG ou WebP · 5 Mo max</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
