'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CURRENCY_LABELS: Record<string, string> = {
  UYU: "Peso uruguayo",
  ARS: "Peso argentino",
  PYG: "Guaraní paraguayo",
  BRL: "Real brasileño",
  MXN: "Peso mexicano",
  CLP: "Peso chileno",
  GTQ: "Quetzal guatemalteco",
  HNL: "Lempira hondureño",
  COP: "Peso colombiano",
};

interface CurrencyRow {
  code: string;
  rate: number;
  updatedAt: string | null;
}

interface GlobalExchangeRateEditorProps {
  initialRates: Record<string, number>;
}

export function GlobalExchangeRateEditor({ initialRates }: GlobalExchangeRateEditorProps) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
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
        .from("exchange_rates")
        .select("id, currency_code, rate_to_usd, updated_at")
        .order("currency_code");

      if (cancelled) return;
      setLoading(false);

      if (error) {
        toast.error(`Error cargando tipos de cambio: ${error.message}`);
        return;
      }

      const rows = (data ?? []) as { id: string; currency_code: string; rate_to_usd: number; updated_at: string | null }[];

      const nextCurrencies: CurrencyRow[] = [];
      const nextRatesStr: Record<string, string> = {};
      const nextSaved: Record<string, number> = {};
      const nextUpdatedAt: Record<string, string | null> = {};

      for (const row of rows) {
        const code = row.currency_code;
        const rateNum = Number(row.rate_to_usd);
        nextCurrencies.push({ code, rate: rateNum, updatedAt: row.updated_at });
        nextRatesStr[code] = Number.isFinite(rateNum) ? String(rateNum) : "";
        if (Number.isFinite(rateNum)) nextSaved[code] = rateNum;
        nextUpdatedAt[code] = row.updated_at ?? null;
      }

      setCurrencies(nextCurrencies);
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
    for (const c of currencies) {
      const val = parseFloat(rates[c.code] ?? "");
      if (isNaN(val) || val <= 0) {
        toast.error(`Ingresá un tipo de cambio válido para ${c.code}.`);
        return;
      }
      parsed[c.code] = val;
    }

    const changedCodes = currencies
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
    const nowIso = new Date().toISOString();

    const upserts = changedCodes.map((code) => ({
      currency_code: code,
      rate_to_usd:   parsed[code],
      updated_at:    nowIso,
    }));

    const { error } = await supabase
      .from("exchange_rates")
      .upsert(upserts, { onConflict: "currency_code" });

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
    <div className="card w-full space-y-4 p-3 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Tipos de cambio globales
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Cuántas unidades de cada moneda equivalen a <strong>1 USD</strong>.
        </p>
      </div>

      <div className="grid w-full gap-3 grid-cols-1 sm:grid-cols-2">
        {currencies.map(({ code }) => (
          <div key={code} className="min-w-0 space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              {code}
              {CURRENCY_LABELS[code] && (
                <span className="font-normal text-[var(--color-text-muted)]"> — {CURRENCY_LABELS[code]}</span>
              )}
            </label>
            <p className="-mt-1 truncate text-[0.65rem] text-[var(--color-text-muted)]">
              Actualizado: {fmtUpdatedAt(lastUpdatedAt[code])}
            </p>
            <div className="flex h-10 w-full overflow-hidden rounded-xl border border-[#d4cfe0] bg-white transition-all focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20">
              <span className="flex shrink-0 items-center border-r border-[#d4cfe0] bg-[#f5f1f8] px-2 text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap sm:px-3">
                1 USD =
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] sm:px-3"
                placeholder="0.00"
                value={rates[code] ?? ""}
                onChange={(e) => setRates((p) => ({ ...p, [code]: e.target.value }))}
                disabled={loading || saving}
              />
              <span className="flex shrink-0 items-center border-l border-[#d4cfe0] bg-[#f5f1f8] px-2 text-xs font-semibold text-[var(--color-text-muted)] sm:px-3">
                {code}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading || saving}
        className="btn-primary w-full text-center text-sm sm:w-auto"
      >
        {loading ? "Cargando..." : saving ? "Guardando..." : "Guardar tipos de cambio"}
      </button>
    </div>
  );
}
