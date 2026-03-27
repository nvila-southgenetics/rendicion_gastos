'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ExchangeRateEditorProps {
  reportId:     string;
  currencies:   string[];
  savedRates:   Record<string, number>;
  /** Presets globales, usados como valor inicial cuando no hay tasa guardada para el reporte */
  globalPresets?: Record<string, number>;
}

const CURRENCY_LABELS: Record<string, string> = {
  UYU: "Peso uruguayo",
  ARS: "Peso argentino",
  PYG: "Guaraní paraguayo",
  BRL: "Real brasileño",
};

export function ExchangeRateEditor({ reportId, currencies, savedRates, globalPresets }: ExchangeRateEditorProps) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [rates, setRates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of currencies) {
      // Prioridad: tasa propia del reporte → preset global → vacío
      const value = savedRates[c] ?? globalPresets?.[c];
      init[c] = value ? String(value) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  if (currencies.length === 0) return null;

  async function handleSave() {
    const parsed: Record<string, number> = {};
    for (const c of currencies) {
      const val = parseFloat(rates[c] ?? "");
      if (isNaN(val) || val <= 0) {
        toast.error(`Ingresá un tipo de cambio válido para ${c}.`);
        return;
      }
      parsed[c] = val;
    }

    setSaving(true);
    const { error } = await supabase
      .from("weekly_reports")
      .update({ exchange_rates: parsed })
      .eq("id", reportId);
    setSaving(false);

    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      return;
    }
    toast.success("Tipos de cambio guardados.");
    router.refresh();
  }

  return (
    <div className="card w-full space-y-4 border-l-4 border-[var(--color-secondary)] p-3 sm:p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Tipos de cambio</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Ingresá cuántas unidades de cada moneda equivalen a <strong>1 USD</strong>.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {currencies.map((currency) => {
          const isFromPreset = !savedRates[currency] && !!globalPresets?.[currency];
          return (
          <div key={currency} className="w-full min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">
                {currency}
                {CURRENCY_LABELS[currency] ? (
                  <span className="font-normal text-[var(--color-text-muted)]"> — {CURRENCY_LABELS[currency]}</span>
                ) : null}
              </label>
              {isFromPreset && (
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-[var(--color-primary)]">
                  Preset global
                </span>
              )}
            </div>
            <div className="flex h-10 w-full overflow-hidden rounded-xl border border-[#d4cfe0] bg-white transition-all focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20">
              <span className="flex shrink-0 items-center border-r border-[#d4cfe0] bg-[#f5f1f8] px-2 text-[0.7rem] font-semibold text-[var(--color-text-muted)] sm:px-3 sm:text-xs">
                1 USD =
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] sm:px-3"
                placeholder="0.00"
                value={rates[currency] ?? ""}
                onChange={(e) => setRates((prev) => ({ ...prev, [currency]: e.target.value }))}
              />
              <span className="flex shrink-0 items-center border-l border-[#d4cfe0] bg-[#f5f1f8] px-2 text-[0.7rem] font-semibold text-[var(--color-text-muted)] sm:px-3 sm:text-xs">
                {currency}
              </span>
            </div>
          </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full text-center text-sm sm:w-auto"
      >
        {saving ? "Guardando..." : "Guardar tipos de cambio"}
      </button>
    </div>
  );
}
