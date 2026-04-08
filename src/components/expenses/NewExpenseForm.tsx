'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TicketUploader, type UploadedFile } from "./TicketUploader";
import type { Enums } from "@/types/database";
import { sendExpenseWebhook } from "@/lib/n8n/sendExpenseWebhook";

type ExpenseCategory = Enums<"expense_category">;

const CATEGORIES = [
  { value: "transport",       label: "Transporte"        },
  { value: "food",            label: "Comida y bebida"   },
  { value: "accommodation",   label: "Alojamiento"       },
  { value: "fuel",            label: "Combustible"       },
  { value: "communication",   label: "Comunicación"      },
  { value: "office_supplies", label: "Insumos de oficina"},
  { value: "entertainment",   label: "Entretenimiento"   },
  { value: "other",           label: "Otros"             },
] as const;

const CURRENCIES = [
  { value: "UYU", label: "Peso uruguayo (UYU)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "GTQ", label: "Quetzal guatemalteco (GTQ)" },
  { value: "HNL", label: "Lempira hondureño (HNL)" },
] as const;

type SubmitState = "idle" | "saving" | "sending" | "success" | "error";

interface NewExpenseFormProps {
  /** ID de la rendición a la que pertenece el gasto (requerido) */
  reportId: string;
  /** URL a la que volver tras guardar */
  returnTo: string;
}

export function NewExpenseForm({ reportId, returnTo }: NewExpenseFormProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [filesUploaded, setFilesUploaded] = useState<UploadedFile[]>([]);
  const [categoria,   setCategoria]  = useState<ExpenseCategory>("transport");
  const [descripcion, setDescripcion] = useState("");
  const [moneda,      setMoneda]      = useState<string>("UYU");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const isSubmitting = submitState === "saving" || submitState === "sending";

  function validate(): boolean {
    if (filesUploaded.length === 0) {
      toast.error("Tenés que subir al menos un comprobante.");
      return false;
    }
    if (!descripcion || descripcion.trim().length < 3) {
      toast.error("La descripción debe tener al menos 3 caracteres.");
      return false;
    }
    if (descripcion.length > 300) {
      toast.error("La descripción no puede superar los 300 caracteres.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitState("saving");

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setSubmitState("error");
      toast.error("No hay sesión activa. Volvé a iniciar sesión.");
      return;
    }

    // ── Insertar gasto directamente en la rendición ───────────────────────────
    const todayStr = new Date().toISOString().slice(0, 10);

    const allUrls = filesUploaded.map((f) => f.publicUrl);

    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        report_id:            reportId,
        user_id:              session.user.id,
        category:             categoria,
        description:          descripcion.trim(),
        merchant_name:        null,
        amount:               0,
        currency:             moneda,
        expense_date:         todayStr,
        ticket_url:           allUrls[0],
        ticket_storage_path:  filesUploaded[0].storagePath,
        ticket_urls:          allUrls,
        status:               "pending",
        n8n_processed:        false,
      })
      .select("*")
      .single();

    if (expenseError || !expense) {
      const msg = expenseError?.message ?? expenseError?.code ?? JSON.stringify(expenseError) ?? "desconocido";
      console.error("expenses INSERT error:", msg, expenseError);
      setSubmitState("error");
      toast.error(`Error guardando el gasto: ${msg}`);
      return;
    }

    // Disparar webhook a n8n para análisis de factura (empresa / monto)
    try {
      await sendExpenseWebhook({
        id: expense.id,
        report_id: expense.report_id,
        user_id: expense.user_id,
        categoria: expense.category,
        descripcion: expense.description,
        monto: Number(expense.amount) || 0,
        moneda: expense.currency ?? moneda,
        fecha: expense.expense_date ?? todayStr,
        comprobante_url: expense.ticket_url ?? allUrls[0],
      });
    } catch (err) {
      console.error("Error enviando webhook de factura a n8n:", err);
      // No bloqueamos al usuario si falla el webhook
    }

    toast.success("¡Gasto cargado correctamente!");
    setSubmitState("success");
    router.push(returnTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">

      {/* ── Comprobante ─────────────────────────────────────── */}
      <section className="space-y-2">
        <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
          Comprobante
        </label>
        <TicketUploader onUploadsChanged={setFilesUploaded} />
      </section>

      {/* ── Categoría ───────────────────────────────────────── */}
      <section className="space-y-2">
        <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
          Categoría
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const active = categoria === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategoria(cat.value)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[#d4cfe0] bg-white text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Descripción ─────────────────────────────────────── */}
      <section className="space-y-2">
        <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
          Descripción
        </label>
        <textarea
          className="input min-h-[90px] resize-none"
          placeholder="Descripción del gasto..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={300}
        />
        <p className="text-right text-[0.7rem] text-[var(--color-text-muted)]">
          {descripcion.length} / 300
        </p>
      </section>

      {/* ── Moneda ──────────────────────────────────────────── */}
      <section className="space-y-2">
        <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
          Moneda
        </label>
        <select
          className="input"
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </section>

      {/* ── Acciones ────────────────────────────────────────── */}
      <div className="flex flex-col-reverse gap-3 border-t border-[#f0ecf4] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          onClick={() => router.push(returnTo)}
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary w-full sm:w-auto"
          disabled={isSubmitting}
        >
          {submitState === "saving"  ? "Guardando..."             :
           submitState === "sending" ? "Procesando comprobante..." :
           submitState === "error"   ? "Reintentar"               :
                                       "Guardar gasto"}
        </button>
      </div>
    </form>
  );
}
