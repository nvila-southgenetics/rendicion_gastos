'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const BUDGET_CURRENCIES = [
  { value: "USD", label: "Dólar (USD)" },
  { value: "UYU", label: "Peso uruguayo (UYU)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "GTQ", label: "Quetzal guatemalteco (GTQ)" },
  { value: "HNL", label: "Lempira hondureño (HNL)" },
] as const;

export function NewReportForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const today = format(new Date(), "yyyy-MM-dd");

  const [titulo,      setTitulo]      = useState("");
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaCierre, setFechaCierre] = useState(today);
  const [presupuesto, setPresupuesto] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [notas, setNotas]             = useState("");
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error("Ingresá un nombre para la rendición.");
      return;
    }
    if (!fechaInicio || !fechaCierre) {
      toast.error("Completá las fechas de la rendición.");
      return;
    }
    if (fechaCierre < fechaInicio) {
      toast.error("La fecha de cierre no puede ser anterior a la de inicio.");
      return;
    }

    const presupuestoNum = presupuesto ? parseFloat(presupuesto) : null;
    if (presupuesto && (isNaN(presupuestoNum!) || presupuestoNum! <= 0)) {
      toast.error("El presupuesto debe ser un número mayor a cero.");
      return;
    }

    setSaving(true);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setSaving(false);
      toast.error("No hay sesión activa.");
      return;
    }

    // Cargar tipos de cambio globales para pre-poblar la rendición
    const { data: presets } = await supabase
      .from("exchange_rates")
      .select("currency_code, rate_to_usd");

    const exchange_rates: Record<string, number> = {};
    for (const p of (presets ?? []) as { currency_code: string; rate_to_usd: number }[]) {
      exchange_rates[p.currency_code] = Number(p.rate_to_usd);
    }

    const { data: report, error } = await supabase
      .from("weekly_reports")
      .insert({
        user_id:        session.user.id,
        title:          titulo.trim(),
        week_start:     fechaInicio,
        week_end:       fechaCierre,
        status:         "open",
        budget_max:     presupuestoNum,
        budget_currency: budgetCurrency,
        notes:          notas.trim() || null,
        exchange_rates: Object.keys(exchange_rates).length > 0 ? exchange_rates : null,
      })
      .select("id")
      .single();

    setSaving(false);

    if (error || !report) {
      const msg = error?.message ?? error?.code ?? "Error desconocido";
      console.error("weekly_reports INSERT:", msg, error);
      toast.error(`No se pudo crear la rendición: ${msg}`);
      return;
    }

    toast.success("Rendición creada. ¡Ahora agregá los gastos!");
    router.push(`/dashboard/reports/${report.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nombre */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-primary)]">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="input"
          placeholder="Ej: Viaje Montevideo, Semana de ventas..."
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={100}
          required
          autoFocus
        />
      </div>

      {/* Fechas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            Fecha de inicio <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="input"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            Fecha de cierre <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="input"
            value={fechaCierre}
            min={fechaInicio}
            onChange={(e) => setFechaCierre(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Presupuesto */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-primary)]">
          Presupuesto máximo{" "}
          <span className="font-normal text-[var(--color-text-muted)]">(opcional)</span>
        </label>
        <div className="grid gap-2 sm:grid-cols-[1fr,220px]">
        <div className="flex h-11 overflow-hidden rounded-xl border border-[#d4cfe0] focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20 bg-white transition-all">
          <span className="flex items-center bg-[#f5f1f8] px-3 text-xs font-semibold text-[var(--color-text-muted)] border-r border-[#d4cfe0] shrink-0 whitespace-nowrap">
            {budgetCurrency}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="flex-1 bg-transparent px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] min-w-0"
            placeholder="0.00"
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
          />
          <span className="flex items-center bg-[#f5f1f8] px-3 text-[0.65rem] text-[var(--color-text-muted)] border-l border-[#d4cfe0] shrink-0">
            máx.
          </span>
        </div>
          <select
            className="input"
            value={budgetCurrency}
            onChange={(e) => setBudgetCurrency(e.target.value)}
          >
            {BUDGET_CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[0.7rem] text-[var(--color-text-muted)]">
          Si lo definís, se mostrará un indicador de progreso al cargar gastos.
        </p>
      </div>

      {/* Notas */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-primary)]">
          Descripción{" "}
          <span className="font-normal text-[var(--color-text-muted)]">(opcional)</span>
        </label>
        <textarea
          className="input min-h-[72px]"
          placeholder="Ej: Viaje a Montevideo, semana de ventas..."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          maxLength={500}
        />
      </div>

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="text-sm font-medium text-[var(--color-primary)]"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancelar
        </button>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
          {saving ? "Creando..." : "Crear rendición"}
        </button>
      </div>
    </form>
  );
}
