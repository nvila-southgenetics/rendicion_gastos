import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { toUSD, totalInCurrency, fmt } from "@/lib/currency";
import { approveReportAction } from "@/app/(dashboard)/reports/[id]/approveReportAction";
import { returnReportAction } from "@/app/(dashboard)/reports/[id]/returnReportAction";
import { PayReportModal } from "@/components/reports/PayReportModal";
import { ApproveReportButton } from "@/components/reports/ApproveReportButton";
import { ReturnReportButton } from "@/components/reports/ReturnReportButton";
import { getMyProfile } from "@/lib/auth/getMyProfile";

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
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function AprobadorReportDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo =
    query.returnTo ??
    (typeof window === "undefined" ? undefined : undefined);
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);
  const isPagador = me?.role === "pagador";
  if (me?.role !== "aprobador" && me?.role !== "admin" && !isPagador) redirect("/dashboard");

  // Verify aprobador can access this report
  const { data: report } = await supabase
    .from("weekly_reports")
    .select("*, profiles!weekly_reports_user_id_fkey(full_name, email, department)")
    .eq("id", id)
    .single();

  if (!report) notFound();

  // If aprobador, verify the report's owner is one of their supervised employees
  if (me?.role === "aprobador") {
    const { data: assignment } = await supabase
      .from("supervision_assignments")
      .select("id")
      .eq("supervisor_id", session.user.id)
      .eq("employee_id", report.user_id)
      .maybeSingle();
    if (!assignment) redirect("/dashboard/aprobador");
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("report_id", id)
    .order("created_at", { ascending: false });

  const { data: presets } = await supabase
    .from("exchange_rates").select("currency_code, rate_to_usd");

  const owner = report.profiles as { full_name: string; email: string; department: string | null } | null;
  const expenseList = expenses ?? [];

  const workflowStatus = (report.workflow_status ?? "draft") as
    | "draft"
    | "submitted"
    | "needs_correction"
    | "approved"
    | "paid";

  const expenseReturnTo = returnTo
    ? `/dashboard/aprobador/reports/${report.id}?returnTo=${encodeURIComponent(returnTo)}`
    : `/dashboard/aprobador/reports/${report.id}`;

  const allExpensesApproved =
    expenseList.length > 0 && expenseList.every((e) => e.status === "approved");

  const hasProblemExpenses = expenseList.some(
    (e) => e.status === "rejected" || e.status === "reviewing",
  );

  const globalPresets: Record<string, number> = {};
  for (const p of (presets ?? []) as { currency_code: string; rate_to_usd: number }[]) globalPresets[p.currency_code] = Number(p.rate_to_usd);
  const reportRates    = (report.exchange_rates ?? {}) as Record<string, number>;
  const effectiveRates = { ...globalPresets, ...reportRates };

  const budgetMax    = report.budget_max ? Number(report.budget_max) : null;
  const budgetCurrency = report.budget_currency ?? "USD";
  const totalInBudgetCurrency = totalInCurrency(
    expenseList.map((e) => ({ amount: Number(e.amount), currency: e.currency ?? "UYU" })),
    budgetCurrency,
    effectiveRates,
  );
  const hasRates     = Object.keys(effectiveRates).length > 0;
  const budgetOverrun = !!(
    budgetMax &&
    totalInBudgetCurrency !== null &&
    totalInBudgetCurrency > budgetMax
  );

  const pendingCount   = expenseList.filter((e) => e.status === "pending").length;
  const reviewingCount = expenseList.filter((e) => e.status === "reviewing").length;
  const approvedCount  = expenseList.filter((e) => e.status === "approved").length;
  const rejectedCount  = expenseList.filter((e) => e.status === "rejected").length;

  const startDate = new Date(report.week_start + "T12:00:00");
  const endDate   = new Date(report.week_end   + "T12:00:00");

  return (
    <div className="w-full max-w-full space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={returnTo ?? "/dashboard/aprobador"}
          className="inline-flex items-center gap-1 rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-[0.7rem] font-semibold text-[var(--color-text-primary)] hover:bg-[#f5f1f8]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          <span>
Volver
          </span>
        </Link>
        <div className="min-w-0">
          <h1 className="page-title break-words">
            {report.title ?? (
              <>
                {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                {" – "}
                {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
              </>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
            {" – "}
            {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <p className="mt-1 break-words text-sm text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text-primary)]">{owner?.full_name ?? "—"}</span>
            {owner?.email && ` · ${owner.email}`}
            {owner?.department && ` · ${owner.department}`}
          </p>
        </div>
      </div>

      {/* Status + budget + acciones */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${
              workflowStatus === "submitted"
                ? "bg-amber-100 text-amber-700"
                : workflowStatus === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : workflowStatus === "paid"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
            }`}
          >
            {workflowStatus === "submitted"
              ? "En revisión"
              : workflowStatus === "approved"
                ? "Aprobada"
                : workflowStatus === "paid"
                  ? "Pagada"
                  : workflowStatus === "needs_correction"
                    ? "Devuelta"
                    : "Borrador"}
          </span>
          {budgetMax && (
            <span
              className={`break-words text-xs font-semibold ${
                budgetOverrun ? "text-red-600" : "text-[var(--color-text-muted)]"
              }`}
            >
              {totalInBudgetCurrency !== null ? `${budgetCurrency} ${fmt(totalInBudgetCurrency)}` : "—"} / {budgetCurrency} {fmt(budgetMax)}
              {budgetOverrun && " ⚠"}
            </span>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          {workflowStatus === "approved" && (
            <a
              href={`/api/reports/export?report_id=${report.id}`}
              className="w-full rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-center text-xs font-medium text-[var(--color-text-primary)] hover:bg-[#f5f1f8] sm:w-auto"
            >
              Exportar Excel
            </a>
          )}
          {isPagador && workflowStatus === "approved" && (
            <PayReportModal reportId={report.id} suggestedAmount={totalInBudgetCurrency} />
          )}
          {workflowStatus === "submitted" && (
            <>
              {hasProblemExpenses && (
                <form action={returnReportAction} className="w-full sm:w-auto">
                  <input type="hidden" name="reportId" value={report.id} />
                  <ReturnReportButton />
                </form>
              )}
              <form action={approveReportAction} className="w-full sm:w-auto">
                <input type="hidden" name="reportId" value={report.id} />
                <ApproveReportButton allExpensesApproved={allExpensesApproved} />
              </form>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: "Pendientes",  value: pendingCount,   color: "text-amber-600" },
          { label: "En revisión", value: reviewingCount, color: "text-blue-600" },
          { label: "Aprobados",   value: approvedCount,  color: "text-emerald-600" },
          { label: "Rechazados",  value: rejectedCount,  color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card px-2 py-3 text-center sm:p-3">
            <p className="truncate text-[0.55rem] font-semibold uppercase text-[var(--color-text-muted)] sm:text-[0.65rem]">{s.label}</p>
            <p className={`mt-1 text-lg font-bold sm:text-xl ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {budgetMax && totalInBudgetCurrency !== null && (
        <div className="card w-full space-y-2 p-3 sm:p-4">
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold uppercase text-[var(--color-text-muted)]">Presupuesto</span>
            <span className={`font-bold ${budgetOverrun ? "text-red-600" : "text-[var(--color-text-primary)]"}`}>
              {budgetCurrency} {fmt(totalInBudgetCurrency)} / {budgetCurrency} {fmt(budgetMax)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f0ecf4]">
            <div
              className={`h-full rounded-full transition-all ${budgetOverrun ? "bg-red-500" : budgetMax && totalInBudgetCurrency / budgetMax >= 0.8 ? "bg-amber-500" : "bg-[var(--color-secondary)]"}`}
              style={{ width: `${Math.min((totalInBudgetCurrency / budgetMax) * 100, 100)}%` }}
            />
          </div>
          <p className="text-right text-[0.65rem] text-[var(--color-text-muted)]">
            {((totalInBudgetCurrency / budgetMax) * 100).toFixed(1)}% del presupuesto utilizado
          </p>
        </div>
      )}

      {/* Información de pago */}
      {workflowStatus === "paid" && (
        <div className="card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Información de pago
          </h2>
          <div className="grid gap-2 text-xs text-[var(--color-text-primary)] sm:grid-cols-3">
            <div>
              <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
                Pagado el
              </p>
              <p className="mt-0.5">
                {report.payment_date
                  ? new Date(report.payment_date + "T12:00:00").toLocaleDateString("es-UY")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
                Monto pagado
              </p>
              <p className="mt-0.5">
                {typeof report.amount_paid === "number"
                  ? `${budgetCurrency} ${fmt(Number(report.amount_paid))}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
                Método de pago
              </p>
              <p className="mt-0.5">{report.payment_destination || "—"}</p>
            </div>
          </div>
          {report.payment_receipt_url && (
            <div className="pt-1">
              <a
                href={report.payment_receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                Ver comprobante ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* Expense list */}
      <div className="card w-full overflow-hidden">
        <div className="space-y-1 border-b border-[#f0ecf4] px-4 py-3 max-[430px]:px-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Gastos ({expenseList.length})
          </h2>
          {expenseList.length > 0 && (
            <p className="text-[0.7rem] text-[var(--color-text-muted)]">
              Tocá cualquier gasto para ver el detalle completo.
            </p>
          )}
        </div>

        {expenseList.length > 0 ? (
          <div className="divide-y divide-[#f0ecf4]">
            {expenseList.map((expense) => {
              const usdAmount = toUSD(
                Number(expense.amount),
                expense.currency ?? "UYU",
                effectiveRates,
              );
              const isUSD = (expense.currency ?? "UYU") === "USD";
              return (
                <Link
                  key={expense.id}
                  href={`/dashboard/expenses/${expense.id}?returnTo=${encodeURIComponent(expenseReturnTo)}`}
                  className="block w-full transition-colors hover:bg-[#fdfbff]"
                >
                  <div className="w-full px-4 py-3 max-[430px]:px-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-primary)]">
                          {expense.description}
                        </span>
                        <ExpenseStatusBadge status={expense.status ?? "pending"} />
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                        {expense.expense_date && (
                          <span>
                            {new Date(
                              expense.expense_date + "T12:00:00",
                            ).toLocaleDateString("es-UY")}
                          </span>
                        )}
                        <span>{CATEGORY_LABELS[expense.category] ?? expense.category}</span>
                        <span className="text-[var(--color-text-primary)]">
                          {expense.merchant_name || "-"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">
                          {fmt(Number(expense.amount))} {expense.currency ?? "UYU"}
                        </span>
                        {!isUSD && usdAmount !== null && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            ≈ USD {fmt(usdAmount)}
                          </span>
                        )}
                      </div>
                      {expense.rejection_reason && (
                        <p className="break-words rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                          Motivo de rechazo: {expense.rejection_reason}
                        </p>
                      )}
                      {expense.admin_notes && expense.status === "reviewing" && (
                        <p className="break-words rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700">
                          Nota: {expense.admin_notes}
                        </p>
                      )}
                      {expense.employee_response && (
                        <p className="break-words rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                          Respuesta del rendidor: {expense.employee_response}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
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
