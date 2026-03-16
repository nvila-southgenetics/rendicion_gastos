'use client';

import { useEffect, useMemo, useState, useActionState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useFormStatus } from "react-dom";
import toast from "react-hot-toast";
import { CreditCard, X } from "lucide-react";
import { payReportAction, type PayReportState } from "@/actions/payReportAction";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Confirmar pago"}
    </button>
  );
}

export function PayReportModal({
  reportId,
  suggestedAmount,
}: {
  reportId: string;
  suggestedAmount?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<PayReportState | null, FormData>(
    payReportAction,
    null,
  );

  const suggestedDefault = useMemo(() => {
    if (typeof suggestedAmount !== "number" || !Number.isFinite(suggestedAmount)) return "";
    return suggestedAmount.toFixed(2);
  }, [suggestedAmount]);

  const todayDefault = useMemo(() => {
    const d = new Date();
    // YYYY-MM-DD para input type="date"
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Rendición marcada como pagada.");
      setOpen(false);
    } else {
      toast.error(state.error || "No se pudo marcar la rendición como pagada.");
    }
  }, [state]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <CreditCard className="h-3 w-3" />
          Pagar rendición
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#e5e2ea] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <Dialog.Title className="text-sm font-semibold text-[var(--color-text-primary)]">
                Registrar pago de rendición
              </Dialog.Title>
              <Dialog.Close className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[#f5f1f8]">
                <X className="h-3.5 w-3.5" />
              </Dialog.Close>
            </div>

            <form action={formAction} className="space-y-3">
              <input type="hidden" name="reportId" value={reportId} />

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                  Fecha de pago
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  required
                  defaultValue={todayDefault}
                  className="input text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                  Monto pagado
                </label>
                <input
                  type="number"
                  name="amountPaid"
                  step="0.01"
                  required
                  defaultValue={suggestedDefault}
                  className="input text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                  Destino del pago
                </label>
                <input
                  type="text"
                  name="paymentDestination"
                  required
                  placeholder='Ej: "Banco ITAU", "Efectivo"...'
                  className="input text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[var(--color-text-primary)]">
                  Comprobante de pago
                </label>
                <input
                  type="file"
                  name="receiptFile"
                  accept="image/*,.pdf"
                  required
                  className="block w-full text-[0.7rem] text-[var(--color-text-muted)] file:mr-2 file:rounded-full file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--color-primary-dark)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close className="rounded-full border border-[#e5e2ea] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[#f5f1f8]">
                  Cancelar
                </Dialog.Close>
                <SubmitButton />
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

