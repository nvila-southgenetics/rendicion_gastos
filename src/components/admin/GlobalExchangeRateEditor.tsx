'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SUPPORTED_CURRENCIES = [
  { code: "UYU", label: "Peso uruguayo" },
  { code: "ARS", label: "Peso argentino" },
  { code: "PYG", label: "Guaraní paraguayo" },
  { code: "BRL", label: "Real brasileño" },
];

interface GlobalExchangeRateEditorProps {
  /** Rates actuales { UYU: 43, ARS: 1000, ... } */
  initialRates: Record<string, number>;
}

export function GlobalExchangeRateEditor({ initialRates }: GlobalExchangeRateEditorProps) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [rates, setRates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const { code } of SUPPORTED_CURRENCIES) {
      init[code] = initialRates[code] ? String(initialRates[code]) : "";
    }
    return init;
  });

  const [lastSavedRates, setLastSavedRates] = useState<Record<string, number>>(() => ({ ...initialRates }));
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fmtUpdatedAt = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("es-UY", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (iso: string | null | undefined) => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return formatter.format(d);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("exchange_rate_presets")
        .select("currency, rate, updated_at");

      if (cancelled) return;
      setLoading(false);

      if (error) {
        toast.error(`Error cargando tipos de cambio: ${error.message}`);
        return;
      }

      const nextRatesStr: Record<string, string> = {};
      const nextSaved: Record<string, number> = {};
      const nextUpdatedAt: Record<string, string | null> = {};

      for (const { code } of SUPPORTED_CURRENCIES) {
        const row = (data ?? []).find((r) => r.currency === code) as
          | { currency: string; rate: number; updated_at: string | null }
          | undefined;

        const rateNum = Number(row?.rate);
        nextRatesStr[code] = row && Number.isFinite(rateNum) ? String(rateNum) : "";
        if (row && Number.isFinite(rateNum)) nextSaved[code] = rateNum;
        nextUpdatedAt[code] = row?.updated_at ?? null;
      }

      setRates(nextRatesStr);
      setLastSavedRates(nextSaved);
      setLastUpdatedAt(nextUpdatedAt);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSave() {
    const parsed: Record<string, number> = {};
    for (const { code } of SUPPORTED_CURRENCIES) {
      const val = parseFloat(rates[code] ?? "");
      if (isNaN(val) || val <= 0) {
        toast.error(`Ingresá un tipo de cambio válido para ${code}.`);
        return;
      }
      parsed[code] = val;
    }

    const changedCodes = SUPPORTED_CURRENCIES
      .map((c) => c.code)
      .filter((code) => {
        const prev = lastSavedRates[code];
        const next = parsed[code];
        if (!prev) return true;
        return Math.abs(prev - next) > 1e-9;
      });

    if (changedCodes.length === 0) {
      toast.success("No hay cambios para guardar.");
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const nowIso = new Date().toISOString();

    const upserts = changedCodes.map((code) => ({
      currency:   code,
      rate:       parsed[code],
      updated_by: session?.user.id ?? null,
      updated_at: nowIso,
    }));

    const { error } = await supabase
      .from("exchange_rate_presets")
      .upsert(upserts, { onConflict: "currency" });

    setSaving(false);

    if (error) {
      toast.error(`Error al guardar: ${error.message}`);
      return;
    }

    setLastSavedRates((prev) => {
      const next = { ...prev };
      for (const code of changedCodes) next[code] = parsed[code];
      return next;
    });
    setLastUpdatedAt((prev) => {
      const next = { ...prev };
      for (const code of changedCodes) next[code] = nowIso;
      return next;
    });

    toast.success("Tipos de cambio globales actualizados.");
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Tipos de cambio globales
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          Valores predeterminados que se aplican automáticamente a cada nueva rendición.
          Cuántas unidades de cada moneda equivalen a <strong>1 USD</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUPPORTED_CURRENCIES.map(({ code, label }) => (
          <div key={code} className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              {code}
              <span className="font-normal text-[var(--color-text-muted)]"> — {label}</span>
            </label>
            <p className="text-[0.7rem] text-[var(--color-text-muted)] -mt-1">
              Última actualización: {fmtUpdatedAt(lastUpdatedAt[code])}
            </p>
            <div className="flex h-10 overflow-hidden rounded-xl border border-[#d4cfe0] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 bg-white transition-all">
              <span className="flex items-center bg-[#f5f1f8] px-3 text-xs font-semibold text-[var(--color-text-muted)] border-r border-[#d4cfe0] whitespace-nowrap shrink-0">
                1 USD =
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="flex-1 bg-transparent px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] min-w-0"
                placeholder="0.00"
                value={rates[code] ?? ""}
                onChange={(e) => setRates((p) => ({ ...p, [code]: e.target.value }))}
                disabled={loading || saving}
              />
              <span className="flex items-center bg-[#f5f1f8] px-3 text-xs font-semibold text-[var(--color-text-muted)] border-l border-[#d4cfe0] shrink-0">
                {code}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading || saving}
        className="btn-primary w-full sm:w-auto text-sm"
      >
        {loading ? "Cargando..." : saving ? "Guardando..." : "Guardar tipos de cambio"}
      </button>
    </div>
  );
}
