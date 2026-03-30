import { notFound, redirect } from "next/navigation";
import { BackButton } from "@/components/ui/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { ExpenseAdminActions } from "@/components/expenses/ExpenseAdminActions";
import { ExchangeRateEditor } from "@/components/reports/ExchangeRateEditor";
import { CurrencyBreakdown } from "@/components/reports/CurrencyBreakdown";
import { CloseReportButton } from "@/components/reports/CloseReportButton";
import { NotifyReviewButton } from "@/components/reports/NotifyReviewButton";
import { DeleteExpenseButton } from "@/components/admin/DeleteExpenseButton";
import { DeleteReportButton } from "@/components/admin/DeleteReportButton";
import { toUSD, totalInUSD, fmt } from "@/lib/currency";
import type { Tables } from "@/types/database";

type Expense = Tables<"expenses">;

const CATEGORY_LABELS: Record<string, string> = {
  transport:       "Transporte",
  food:            "Comida y bebida",
  accommodation:   "Alojamiento",
  fuel:            "Combustible",
  communication:   "Comunicación",
  office_supplies: "Insumos de oficina",
  entertainment:   "Entretenimiento",
  other:           "Otros",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminReportDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);
  if (me?.role !== "admin") redirect("/dashboard");

  const [{ data: report }, { data: expenses }, { data: presets }] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("*, profiles!weekly_reports_user_id_fkey(full_name, email, department)")
      .eq("id", id)
      .single(),
    supabase
      .from("expenses")
      .select("*")
      .eq("report_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("exchange_rates").select("currency_code, rate_to_usd"),
  ]);

  if (!report) notFound();

  const user = report.profiles as { full_name: string; email: string; department: string | null } | null;
  const isOpen = report.status === "open";
  const expenseList = (expenses ?? []) as Expense[];

  // Monedas distintas a USD usadas en los gastos
  const usedCurrencies = [...new Set(
    expenseList.map((e) => e.currency ?? "UYU").filter((c) => c !== "USD")
  )].sort();

  // Presets globales como base; las tasas propias del reporte tienen prioridad
  const globalPresets: Record<string, number> = {};
  for (const p of (presets ?? []) as { currency_code: string; rate_to_usd: number }[]) globalPresets[p.currency_code] = Number(p.rate_to_usd);
  const reportRates    = (report.exchange_rates ?? {}) as Record<string, number>;
  const savedRates     = reportRates; // tasas guardadas en el reporte (para el editor)
  const effectiveRates: Record<string, number> = { ...globalPresets, ...reportRates };

  const totalUSD      = totalInUSD(expenseList.map((e) => ({ amount: Number(e.amount), currency: e.currency ?? "UYU" })), effectiveRates);
  const ratesComplete = usedCurrencies.every((c) => effectiveRates[c]);

  // Totales por moneda
  const totalsByCurrency: Record<string, number> = {};
  for (const e of expenseList) {
    const cur = e.currency ?? "UYU";
    totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(e.amount ?? 0);
  }

  const pendingCount   = expenseList.filter((e) => e.status === "pending").length;
  const reviewingCount = expenseList.filter((e) => e.status === "reviewing").length;
  const approvedCount  = expenseList.filter((e) => e.status === "approved").length;
  const rejectedCount  = expenseList.filter((e) => e.status === "rejected").length;

  const budgetMax     = report.budget_max ? Number(report.budget_max) : null;
  const budgetOverrun = budgetMax && totalUSD !== null ? totalUSD > budgetMax : false;

  return (
    <div className="w-full max-w-full space-y-5">
      {/* Encabezado */}
      <div className="space-y-3">
        <BackButton href="/admin/reports" />

        <div className="min-w-0">
          <h1 className="page-title">
            {report.title ?? (
              <>
                {new Date(report.week_start + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "long" })}
                {" — "}
                {new Date(report.week_end + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" })}
              </>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {new Date(report.week_start + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
            {" – "}
            {new Date(report.week_end + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <p className="mt-0.5 break-words text-sm text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text-primary)]">{user?.full_name ?? "—"}</span>
            {" · "}{user?.email}
            {user?.department && ` · ${user.department}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${
              isOpen
                ? "bg-emerald-100 text-emerald-700"
                : "bg-purple-100 text-[var(--color-primary)]"
            }`}
          >
            {isOpen ? "Abierta" : "Cerrada"}
          </span>
          <a
            href={`/api/reports/export?report_id=${report.id}`}
            className="rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[#f5f1f8]"
          >
            Exportar Excel
          </a>
          {isOpen && (
            <CloseReportButton
              reportId={report.id}
              currentStatus={report.status as "open" | "closed"}
            />
          )}
          {!isOpen && user && (
            <NotifyReviewButton
              reportId={report.id}
              employeeId={report.user_id}
              employeeName={user.full_name}
              employeeEmail={user.email}
            />
          )}
          <DeleteReportButton
            reportId={report.id}
            reportTitle={report.title ?? `${report.week_start} – ${report.week_end}`}
            expenseCount={expenseList.length}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: "Pendientes",   value: pendingCount,   color: "text-amber-600" },
          { label: "En revisión",  value: reviewingCount, color: "text-blue-600" },
          { label: "Aprobados",    value: approvedCount,  color: "text-emerald-600" },
          { label: "Rechazados",   value: rejectedCount,  color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center sm:p-4">
            <p className="text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)] sm:text-[0.65rem]">{s.label}</p>
            <p className={`mt-1 text-xl font-bold sm:text-2xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Total rendición con desglose */}
      {expenseList.length > 0 && (
        <div className="card w-full space-y-3 p-3 sm:p-4">
          <CurrencyBreakdown
            totalsByCurrency={totalsByCurrency}
            totalUSD={totalUSD}
            budgetMax={budgetMax}
            budgetOverrun={budgetOverrun ?? false}
          />
          {/* Barra de presupuesto */}
          {budgetMax && totalUSD !== null && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#f0ecf4]">
                <div
                  className={`h-full rounded-full transition-all ${budgetOverrun ? "bg-red-500" : "bg-[var(--color-secondary)]"}`}
                  style={{ width: `${Math.min((totalUSD / budgetMax) * 100, 100)}%` }}
                />
              </div>
              <p className="text-right text-[0.65rem] text-[var(--color-text-muted)]">
                {((totalUSD / budgetMax) * 100).toFixed(1)}% del presupuesto utilizado
              </p>
            </div>
          )}
          {usedCurrencies.length > 0 && !ratesComplete && (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              Definí los tipos de cambio para ver el total en USD.
            </p>
          )}
        </div>
      )}

      {/* Editor de tipos de cambio */}
      {usedCurrencies.length > 0 && (
        <ExchangeRateEditor
          reportId={report.id}
          currencies={usedCurrencies}
          savedRates={savedRates}
          globalPresets={globalPresets}
        />
      )}

      {/* Gastos */}
      <div className="card w-full overflow-hidden">
        <div className="border-b border-[#f0ecf4] px-4 py-3 max-[430px]:px-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Gastos ({expenseList.length})
          </h2>
        </div>

        {expenseList.length > 0 ? (
          <div className="divide-y divide-[#f0ecf4]">
            {expenseList.map((expense) => {
              const usdAmount = toUSD(Number(expense.amount), expense.currency ?? "UYU", effectiveRates);
              const isOriginalUSD = (expense.currency ?? "UYU") === "USD";
              return (
                <div key={expense.id} className="w-full px-4 py-3 transition-colors hover:bg-[#fdfbff] max-[430px]:px-3">
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-semibold text-[var(--color-text-primary)]">
                          {expense.description}
                        </span>
                        <ExpenseStatusBadge status={expense.status ?? "pending"} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                        <span>{new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY")}</span>
                        <span>{CATEGORY_LABELS[expense.category] ?? expense.category}</span>
                      </div>

                      <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">
                          {fmt(Number(expense.amount))} {expense.currency ?? "UYU"}
                        </span>
                        {!isOriginalUSD && (
                          usdAmount !== null ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              ≈ USD {fmt(usdAmount)}
                            </span>
                          ) : ratesComplete === false && (
                            <span className="text-[0.65rem] italic text-[var(--color-text-muted)]">
                              (sin tipo de cambio)
                            </span>
                          )
                        )}
                      </div>

                      {expense.rejection_reason && (
                        <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                          Motivo de rechazo: {expense.rejection_reason}
                        </p>
                      )}
                      {expense.ticket_url && (
                        <a
                          href={expense.ticket_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[0.7rem] text-[var(--color-primary)] underline underline-offset-2"
                        >
                          Ver comprobante ↗
                        </a>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <ExpenseAdminActions
                        expenseId={expense.id}
                        currentStatus={expense.status ?? "pending"}
                      />
                      <DeleteExpenseButton
                        expenseId={expense.id}
                        description={expense.description}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            Esta rendición no tiene gastos.
          </p>
        )}
      </div>
    </div>
  );
}
