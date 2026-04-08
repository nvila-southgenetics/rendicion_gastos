"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface UploadedFile {
  storagePath: string;
  publicUrl:   string;
  previewUrl:  string;  // object URL for local preview
  name:        string;
  mimeType:    string;
}

interface TicketUploaderProps {
  /** Se llama cada vez que la lista de archivos cambia (subida o eliminación) */
  onUploadsChanged: (files: UploadedFile[]) => void;
  /** Archivos ya subidos (para modo edición) */
  existingUrls?: string[];
}

export function TicketUploader({ onUploadsChanged, existingUrls = [] }: TicketUploaderProps) {
  const supabase  = createSupabaseBrowserClient();
  const inputRef  = useRef<HTMLInputElement>(null);

  // Archivos ya subidos anteriormente (modo edición) — sólo URLs, sin preview local
  const [existing, setExisting] = useState<string[]>(existingUrls);

  // Archivos recién subidos en esta sesión
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);

  // Por cada archivo en cola: id → progreso 0-100 | "error"
  const [progress, setProgress] = useState<Record<string, number | "error">>({});

  const [dragging, setDragging] = useState(false);

  const isPdfFile = (file: File) => file.type === "application/pdf";
  const isImageFile = (file: File) => file.type.startsWith("image/");
  const isPdfUrl = (url: string) => /\.pdf($|[?#])/i.test(url);

  // Notifica al padre DESPUÉS del render para evitar setState-durante-render
  const onUploadsChangedRef = useRef(onUploadsChanged);
  onUploadsChangedRef.current = onUploadsChanged;

  useEffect(() => {
    onUploadsChangedRef.current(uploaded);
  }, [uploaded]);

  async function uploadFile(file: File) {
    if (!isImageFile(file) && !isPdfFile(file)) {
      toast.error(`"${file.name}": solo se permiten imágenes o PDF.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`"${file.name}" supera los 10MB.`);
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      toast.error("Debes iniciar sesión para subir archivos.");
      return;
    }

    const uid      = session.user.id;
    const ext      = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path     = `${uid}/${fileName}`;
    const tempId   = fileName;

    setProgress((p) => ({ ...p, [tempId]: 10 }));

    const { error: uploadError } = await supabase.storage
      .from("comprobantes")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      setProgress((p) => ({ ...p, [tempId]: "error" }));
      const message = uploadError.message || uploadError.name || "Error desconocido";
      toast.error(`Error subiendo "${file.name}": ${message}`);
      setTimeout(() => setProgress((p) => { const n = { ...p }; delete n[tempId]; return n; }), 3000);
      return;
    }

    setProgress((p) => ({ ...p, [tempId]: 90 }));

    const { data: { publicUrl } } = supabase.storage
      .from("comprobantes")
      .getPublicUrl(path);

    const entry: UploadedFile = {
      storagePath: `comprobantes/${path}`,
      publicUrl,
      previewUrl:  URL.createObjectURL(file),
      name:        file.name,
      mimeType:    file.type,
    };

    setUploaded((prev) => [...prev, entry]);

    setProgress((p) => { const n = { ...p }; delete n[tempId]; return n; });
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;

    // Solo se permite un comprobante por gasto (entre existentes y nuevos)
    const currentCount = existing.length + uploaded.length;
    if (currentCount >= 1) {
      toast.error("Solo se permite un comprobante por gasto.");
      return;
    }

    const first = Array.from(files)[0];
    if (first) void uploadFile(first);
  }

  function removeUploaded(index: number) {
    setUploaded((prev) => prev.filter((_, i) => i !== index));
  }

  function removeExisting(url: string) {
    setExisting((prev) => prev.filter((u) => u !== url));
  }

  const uploadingCount = Object.keys(progress).length;
  const hasFiles       = existing.length > 0 || uploaded.length > 0;
  const reachedLimit   = existing.length + uploaded.length >= 1;

  return (
    <div className="space-y-3">
      {/* Grid de previews */}
      {hasFiles && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {/* Imágenes existentes (modo edición) */}
          {existing.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-[#e5e2ea] bg-black/5">
              {isPdfUrl(url) ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#f5f1f8] text-center">
                  <span className="text-2xl">PDF</span>
                  <span className="px-2 text-[0.65rem] text-[var(--color-text-muted)]">Comprobante PDF</span>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Comprobante" className="h-full w-full object-cover" />
                </>
              )}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20"
              />
              <button
                type="button"
                onClick={() => removeExisting(url)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                title="Quitar"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Archivos recién subidos */}
          {uploaded.map((f, i) => (
            <div key={f.storagePath} className="group relative aspect-square overflow-hidden rounded-xl border border-[#e5e2ea] bg-black/5">
              {f.mimeType === "application/pdf" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#f5f1f8] text-center">
                  <span className="text-2xl">PDF</span>
                  <span className="px-2 text-[0.65rem] text-[var(--color-text-muted)]">{f.name}</span>
                </div>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.previewUrl} alt={f.name} className="h-full w-full object-cover" />
                </>
              )}
              <a
                href={f.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20"
              />
              <button
                type="button"
                onClick={() => removeUploaded(i)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                title="Quitar"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Indicadores de subida en progreso */}
          {Object.entries(progress).map(([id, pct]) => (
            <div key={id} className="relative aspect-square overflow-hidden rounded-xl border border-[#e5e2ea] bg-[#f5f1f8] flex flex-col items-center justify-center gap-2 p-3">
              {pct === "error" ? (
                <p className="text-xs font-medium text-red-500">Error</p>
              ) : (
                <>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#e5e2ea]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)]">Subiendo…</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zona de drop / botón agregar */}
      <div
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFilesSelected(e.dataTransfer.files); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-[var(--color-primary)] bg-[rgba(130,3,138,0.04)]"
            : "border-[#d4cfe0] bg-[#faf8fc] hover:border-[var(--color-primary)]/60"
        }`}
      >
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {hasFiles ? "Comprobante cargado" : "Arrastrá el comprobante aquí"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Imágenes (JPG, PNG, WEBP) o PDF · máx. 10 MB por archivo
          </p>
        </div>

        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
          uploadingCount > 0 || reachedLimit
            ? "border-[#d4cfe0] bg-white text-[var(--color-text-muted)] cursor-not-allowed"
            : "border-[var(--color-primary)] text-[var(--color-primary)] bg-white hover:bg-[#faf5ff]"
        }`}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.pdf,application/pdf,image/jpeg"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
            disabled={uploadingCount > 0 || reachedLimit}
          />
          {uploadingCount > 0
            ? `Subiendo comprobante…`
            : hasFiles
            ? "Reemplazar comprobante"
            : "Seleccionar archivo"}
        </label>
      </div>
    </div>
  );
}
