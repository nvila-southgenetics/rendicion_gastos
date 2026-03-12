'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TicketUploader, type UploadedFile } from "./TicketUploader";
import type { Tables } from "@/types/database";

type Expense = Tables<"expenses">;

interface EditExpenseFormProps {
  expense: Expense;
}

const CATEGORIES = [
  { value: "transport",       label: "Transporte"         },
  { value: "food",            label: "Comida y bebida"    },
  { value: "accommodation",   label: "Alojamiento"        },
  { value: "fuel",            label: "Combustible"        },
  { value: "communication",   label: "Comunicación"       },
  { value: "office_supplies", label: "Insumos de oficina" },
  { value: "entertainment",   label: "Entretenimiento"    },
  { value: "other",           label: "Otros"              },
] as const;

const CURRENCIES = [
  { value: "UYU", label: "Peso uruguayo (UYU)" },
  { value: "USD", label: "Dólar (USD)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "PYG", label: "Guaraní paraguayo (PYG)" },
  { value: "BRL", label: "Real brasileño (BRL)" },
] as const;

export function EditExpenseForm({ expense }: EditExpenseFormProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [categoria, setCategoria]     = useState(expense.category ?? "other");
  const [descripcion, setDescripcion] = useState(expense.description ?? "");
  const [moneda, setMoneda]           = useState(expense.currency ?? "UYU");
  const [monto, setMonto]             = useState(String(expense.amount ?? "0"));
  const [fecha, setFecha]             = useState(expense.expense_date ?? "");
  const [newTickets, setNewTickets]   = useState<UploadedFile[]>([]);
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [employeeResponse, setEmployeeResponse] = useState(expense.employee_response ?? "");

  const isLocked = expense.status === "approved" || expense.status === "rejected";
  const isReviewing = expense.status === "reviewing";

  function validate(): boolean {
    if (!descripcion || descripcion.trim().length < 3) {
      toast.error("La descripción debe tener al menos 3 caracteres.");
      return false;
    }
    if (descripcion.length > 300) {
      toast.error("La descripción no puede superar los 300 caracteres.");
      return false;
    }
    if (!fecha) {
      toast.error("Seleccioná una fecha.");
      return false;
    }
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error("El monto debe ser un número válido.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    if (!validate()) return;

    setSaving(true);

    const updates: Partial<Expense> = {
      category:    categoria as Expense["category"],
      description: descripcion.trim(),
      currency:    moneda,
      amount:      parseFloat(monto) as unknown as Expense["amount"],
      expense_date: fecha,
    };

    if (newTickets.length > 0) {
      // Combinar URLs existentes con las nuevas
      const existingUrls  = (expense.ticket_urls ?? (expense.ticket_url ? [expense.ticket_url] : []));
      const newUrls       = newTickets.map((f) => f.publicUrl);
      const allUrls       = [...existingUrls, ...newUrls];
      updates.ticket_url          = allUrls[0];
      updates.ticket_storage_path = newTickets[0].storagePath;
      updates.ticket_urls         = allUrls;
      updates.n8n_processed       = false;
    }
    // Si el gasto estaba en revisión, vuelve a estado pending y guardamos la respuesta del empleado
    if (isReviewing) {
      updates.status = "pending" as Expense["status"];
      updates.employee_response = employeeResponse.trim() || null;
      updates.n8n_processed = false;
    }

    const { error } = await supabase
      .from("expenses")
      .update(updates)
      .eq("id", expense.id);

    setSaving(false);

    if (error) {
      const msg = error.message ?? error.code ?? JSON.stringify(error);
      console.error("expenses UPDATE error:", msg, error);
      toast.error(`No se pudo guardar: ${msg}`);
      return;
    }

    // Si estaba en revisión, notificar que se corrigió y se reenvía
    if (isReviewing) {
      try {
        await fetch("/api/gasto-corregido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expenseId: expense.id,
            employeeResponse: employeeResponse.trim(),
          }),
        });
      } catch (err) {
        console.error("Error llamando webhook de gasto corregido:", err);
      }
    }

    toast.success("Gasto actualizado correctamente.");
    router.push(`/dashboard/expenses/${expense.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm("¿Seguro que querés eliminar este gasto? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);
    setDeleting(false);
    if (error) {
      const msg = error.message ?? error.code ?? JSON.stringify(error);
      console.error("expenses DELETE error:", msg, error);
      toast.error(`No se pudo eliminar: ${msg}`);
      return;
    }
    toast.success("Gasto eliminado.");
    router.push("/dashboard/expenses");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isLocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Este gasto está <strong>{expense.status === "approved" ? "aprobado" : "rechazado"}</strong> y no puede editarse.
        </div>
      )}

      {isReviewing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Este gasto está en revisión</p>
          {expense.supervisor_comment && (
            <p>
              Comentario del supervisor:{" "}
              <span className="font-medium">{expense.supervisor_comment}</span>
            </p>
          )}
        </div>
      )}

      {/* Comprobantes */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          Comprobantes <span className="normal-case font-normal">(podés agregar más)</span>
        </p>
        {!isLocked && (
          <TicketUploader
            onUploadsChanged={setNewTickets}
            existingUrls={expense.ticket_urls ?? (expense.ticket_url ? [expense.ticket_url] : [])}
          />
        )}
        {isLocked && expense.ticket_url && (
          <a
            href={expense.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] underline underline-offset-2"
          >
            Ver comprobante ↗
          </a>
        )}
      </div>

      {/* Categoría */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-[var(--color-text-primary)]">Categoría</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const active = categoria === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                disabled={isLocked}
                onClick={() => setCategoria(cat.value)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Descripción */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Descripción</label>
          <textarea
            className="input min-h-[80px]"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={300}
            disabled={isLocked}
          />
          <p className="text-[0.7rem] text-right text-[var(--color-text-muted)]">{descripcion.length}/300</p>
        </div>

        {/* Monto */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Monto</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={isLocked}
          />
        </div>

        {/* Moneda */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Moneda</label>
          <select
            className="input"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value)}
            disabled={isLocked}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Fecha */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Fecha del gasto</label>
          <input
            type="date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            disabled={isLocked}
          />
        </div>
      </div>

      {isReviewing && !isLocked && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
            Tu respuesta / explicación (opcional)
          </label>
          <textarea
            className="input min-h-[80px] text-sm"
            value={employeeResponse}
            onChange={(e) => setEmployeeResponse(e.target.value)}
            maxLength={500}
            placeholder="Explicá qué cambiaste o por qué considerás válido este gasto…"
            disabled={isLocked}
          />
          <p className="text-[0.7rem] text-right text-[var(--color-text-muted)]">
            {employeeResponse.length}/500
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="text-sm font-medium text-[var(--color-primary)]"
          onClick={() => router.back()}
          disabled={saving || deleting}
        >
          Cancelar
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {!isLocked && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              Eliminar gasto
            </button>
          )}
          {!isLocked && (
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={saving}
            >
              {isReviewing
                ? saving
                  ? "Reenviando..."
                  : "Guardar y reenviar"
                : saving
                  ? "Guardando..."
                  : "Guardar cambios"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
