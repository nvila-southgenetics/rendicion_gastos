'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CurrencyBreakdown } from "./CurrencyBreakdown";
import { totalInCurrency, fmt } from "@/lib/currency";

interface SimpleExpense {
  id:           string;
  amount:       number;
  currency:     string | null;
  status:       string | null;
}

interface RealtimeBudgetSectionProps {
  reportId:    string;
  budgetMax:   number | null;
  budgetCurrency: string;
  savedRates:  Record<string, number>;
  /** Lista inicial de gastos para el primer render */
  initialExpenses: SimpleExpense[];
}

export function RealtimeBudgetSection({
  reportId,
  budgetMax,
  budgetCurrency,
  savedRates,
  initialExpenses,
}: RealtimeBudgetSectionProps) {
  const supabase = createSupabaseBrowserClient();
  const [expenses, setExpenses] = useState<SimpleExpense[]>(initialExpenses);

  useEffect(() => {
    // Suscripción Realtime a INSERT, UPDATE y DELETE en esta rendición
    const channel = supabase
      .channel(`budget-${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:  "expenses",
          filter: `report_id=eq.${reportId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const e = payload.new as SimpleExpense;
            setExpenses((prev) => {
              if (prev.find((x) => x.id === e.id)) return prev;
              return [...prev, e];
            });
          } else if (payload.eventType === "UPDATE") {
            const e = payload.new as SimpleExpense;
            setExpenses((prev) => prev.map((x) => (x.id === e.id ? e : x)));
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setExpenses((prev) => prev.filter((x) => x.id !== id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [reportId, supabase]);

  // Cálculos derivados
  const effectiveExpenses = expenses.filter(
    (e) => e.status !== "rejected",
  );

  const totalInBudgetCurrency = totalInCurrency(
    effectiveExpenses.map((e) => ({
      amount: Number(e.amount),
      currency: e.currency ?? "UYU",
    })),
    budgetCurrency,
    savedRates,
  );

  const hasRates    = Object.keys(savedRates).length > 0;
  const budgetPct   = budgetMax && totalInBudgetCurrency !== null
    ? Math.min((totalInBudgetCurrency / budgetMax) * 100, 100)
    : null;
  const budgetOverrun = !!(
    budgetMax &&
    totalInBudgetCurrency !== null &&
    totalInBudgetCurrency > budgetMax
  );
  const pendingCount  = expenses.filter((e) => e.status === "pending").length;

  const totalsByCurrency: Record<string, number> = {};
  for (const e of effectiveExpenses) {
    const cur = e.currency ?? "UYU";
    totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(e.amount ?? 0);
  }

  return (
    <div className="space-y-3">
      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">Gastos</p>
          <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{expenses.length}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">Pendientes</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Barra de presupuesto */}
      {budgetMax && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              Presupuesto
            </span>
            <span className={`text-xs font-bold tabular-nums ${budgetOverrun ? "text-red-600" : "text-[var(--color-text-primary)]"}`}>
              {totalInBudgetCurrency !== null
                ? `${budgetCurrency} ${fmt(totalInBudgetCurrency)}`
                : hasRates
                  ? "calculando…"
                  : "—"}
              <span className="font-normal text-[var(--color-text-muted)]">
                {" "}
                / {budgetCurrency} {fmt(budgetMax)}
              </span>
              {budgetOverrun && <span className="ml-1 text-red-600">⚠ Excedido</span>}
            </span>
          </div>

          {/* Track */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#f0ecf4] relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budgetOverrun
                  ? "bg-red-500"
                  : budgetPct !== null && budgetPct >= 80
                  ? "bg-amber-500"
                  : "bg-[var(--color-secondary)]"
              }`}
              style={{ width: `${budgetPct ?? 0}%` }}
            />
            {/* Marcador de 100% */}
            <div className="absolute right-0 top-0 h-full w-0.5 bg-[#d4cfe0]" />
          </div>

          <div className="flex items-center justify-between text-[0.65rem] text-[var(--color-text-muted)]">
            <span>0%</span>
            <span className={budgetOverrun ? "text-red-500 font-semibold" : ""}>
              {budgetPct !== null ? `${budgetPct.toFixed(1)}% utilizado` : "Sin tipo de cambio"}
            </span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Desglose por moneda */}
      {expenses.length > 0 && (
        <div className="card px-4 py-3">
          <CurrencyBreakdown
            totalsByCurrency={totalsByCurrency}
            totalUSD={
              budgetCurrency === "USD" ? totalInBudgetCurrency : null
            }
            budgetMax={budgetMax}
            budgetOverrun={budgetOverrun}
          />
        </div>
      )}
    </div>
  );
}
