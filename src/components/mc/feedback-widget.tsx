"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { Camera, X, Loader2 } from "lucide-react";

type FeedbackType = "bug" | "amélioration";
type Priority = "low" | "medium" | "high" | "critical";

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-red-50 text-red-700 border-red-200",
};

const SCREENSHOT_BUCKET = "feedback-screenshots";
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

export function FeedbackWidget({ orgSlug }: { orgSlug?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [priority, setPriority] = useState<Priority>("medium");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Screenshot
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();

  async function handleScreenshotFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté (JPG, PNG, WebP, GIF).");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Image trop lourde (5 Mo max).");
      return;
    }

    // Aperçu local immédiat
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingScreenshot(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        toast.error("Échec de l'upload de la capture.");
        setScreenshotPreview(null);
        return;
      }

      const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
      setScreenshotUrl(data.publicUrl);
    } finally {
      setUploadingScreenshot(false);
    }
  }

  function removeScreenshot() {
    setScreenshotUrl(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForm() {
    setDescription("");
    setType("bug");
    setPriority("medium");
    setScreenshotUrl(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    if (uploadingScreenshot) {
      toast.error("L'image est encore en cours d'envoi, patientez.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Infos environnement (collectées côté client)
    let deviceType: "mobile" | "tablet" | "desktop" = "desktop";
    let osHint: string | null = null;
    let userAgentStr: string | null = null;
    let screenW: number | null = null;
    let screenH: number | null = null;
    if (typeof window !== "undefined") {
      userAgentStr = navigator.userAgent;
      screenW = window.screen.width;
      screenH = window.screen.height;
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|android.*mobile|windows phone/.test(ua)) deviceType = "mobile";
      else if (/ipad|android(?!.*mobile)|tablet/.test(ua)) deviceType = "tablet";
      // OS hint
      if (/windows/.test(ua))      osHint = "Windows";
      else if (/macintosh|mac os x/.test(ua)) osHint = "macOS";
      else if (/iphone|ipad/.test(ua)) osHint = "iOS";
      else if (/android/.test(ua)) osHint = "Android";
      else if (/linux/.test(ua))   osHint = "Linux";
    }

    const { error } = await supabase.from("feedback").insert({
      type,
      priority,
      description: description.trim(),
      url: typeof window !== "undefined" ? window.location.href : pathname,
      page_title: typeof document !== "undefined" ? document.title : "",
      org_slug: orgSlug ?? null,
      screenshot_url: screenshotUrl ?? null,
      user_agent: userAgentStr,
      device_type: deviceType,
      screen_width: screenW,
      screen_height: screenH,
      os_hint: osHint,
    });

    setLoading(false);

    if (error) {
      toast.error("Erreur lors de l'envoi du ticket");
      return;
    }

    toast.success("Ticket enregistré ✓");
    resetForm();
    setOpen(false);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel — max-height pour éviter d'être coupé sur les petits écrans */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl max-h-[calc(100vh-6rem)] flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">
              Signaler un retour
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
            {/* Type */}
            <div className="grid grid-cols-2 gap-2">
              {(["bug", "amélioration"] as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    type === t
                      ? t === "bug"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {t === "bug" ? "🐛 Bug" : "✨ Amélioration"}
                </button>
              ))}
            </div>

            {/* Priorité */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Priorité
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-all ${
                      priority === p
                        ? PRIORITY_COLORS[p] + " ring-1 ring-current"
                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "Décris ce qui ne fonctionne pas..."
                    : "Décris ton idée d'amélioration..."
                }
                rows={4}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
              />
            </div>

            {/* Screenshot */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Capture d'écran <span className="font-normal text-slate-400">(optionnel)</span>
              </label>

              {screenshotPreview ? (
                <div className="relative inline-flex">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshotPreview}
                    alt="Capture"
                    className="h-16 w-auto max-w-full rounded-lg border border-slate-200 object-cover"
                  />
                  {uploadingScreenshot && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
                      <Loader2 className="size-4 animate-spin text-slate-500" />
                    </div>
                  )}
                  {!uploadingScreenshot && (
                    <button
                      type="button"
                      onClick={removeScreenshot}
                      className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-slate-900 transition-colors"
                      title="Supprimer la capture"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-[12.5px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                >
                  <Camera className="size-4 shrink-0 text-slate-400" />
                  Ajouter une capture d'écran
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScreenshotFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {/* URL actuelle */}
            <p className="text-[10px] text-slate-400 truncate">
              📍 {typeof window !== "undefined" ? window.location.pathname : pathname}
            </p>

            {/* Règles de triage */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Comment ça marche</p>
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  <span className="font-medium text-slate-700">Traité automatiquement</span> — bug graphique, faute d'orthographe, erreur technique claire
                </p>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-amber-500">◎</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  <span className="font-medium text-slate-700">Accord demandé</span> — changement de contenu, formulation, fonctionnalité ou design
                </p>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-slate-400">✕</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  <span className="font-medium text-slate-700">Ignoré</span> — feedback vague, doublon ou hors périmètre
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !description.trim() || uploadingScreenshot}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Envoi…" : uploadingScreenshot ? "Capture en cours…" : "Envoyer le ticket"}
            </button>
          </form>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Signaler un bug ou une amélioration"
        className={`fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${
          open
            ? "bg-slate-700 text-white"
            : "bg-slate-900 text-white hover:bg-slate-700"
        }`}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v4m0 4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    </>
  );
}
