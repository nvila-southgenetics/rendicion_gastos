import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { RealtimeBudgetSection } from "@/components/reports/RealtimeBudgetSection";
import { toUSD, totalInCurrency, fmt } from "@/lib/currency";
import type { Tables } from "@/types/database";
import { submitReportAction } from "./submitReportAction";
import { returnReportAction } from "./returnReportAction";
import { approveReportAction } from "./approveReportAction";
import { SubmitReportButton } from "@/components/reports/SubmitReportButton";

type WeeklyReport = Tables<"weekly_reports">;
type Expense      = Tables<"expenses">;

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

const WORKFLOW_LABELS: Record<string, string> = {
  draft:            "Borrador",
  submitted:        "Enviada a revisión",
  needs_correction: "Con correcciones pendientes",
  approved:         "Aprobada",
  paid:             "Pagada",
};

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);
  const isChusma = me?.role === "chusmas" || me?.role === "chusma";

  const reportQuery = supabase.from("weekly_reports").select("*").eq("id", id);
  if (!isChusma) {
    reportQuery.eq("user_id", session.user.id);
  }

  const [{ data: report }, { data: expenses }, { data: presets }] = await Promise.all([
    reportQuery.maybeSingle(),
    supabase.from("expenses").select("*").eq("report_id", id).order("created_at", { ascending: false }),
    supabase.from("exchange_rates").select("currency_code, rate_to_usd"),
  ]);

  if (!report) notFound();

  const r = report as WeeklyReport;
  const isOpen = r.status === "open";
  // Dueño real de la rendición (incluye empleados y chusmas que creen sus propias rendiciones)
  const isOwner = session.user.id === r.user_id;
  const isSupervisor = session.user.id !== r.user_id && !isChusma;
  const startDate = new Date(r.week_start + "T12:00:00");
  const endDate   = new Date(r.week_end   + "T12:00:00");

  const expenseList = (expenses ?? []) as Expense[];
  const nonRejectedExpenses = expenseList.filter((e) => e.status !== "rejected");

  const workflowStatus = (r.workflow_status ?? "draft") as
    | "draft"
    | "submitted"
    | "needs_correction"
    | "approved"
    | "paid";

  const canEmployeeEditReport =
    isOwner && (workflowStatus === "draft" || workflowStatus === "needs_correction");
  const isSubmittedOrBeyond =
    workflowStatus === "submitted" ||
    workflowStatus === "approved" ||
    workflowStatus === "paid";

  const allExpensesApproved =
    expenseList.length > 0 && expenseList.every((e) => e.status === "approved");

  const canSupervisorAct = isSupervisor && workflowStatus === "submitted";

  // Presets globales como base, sobreescritos por las tasas propias del reporte
  const globalPresets: Record<string, number> = {};
  for (const p of (presets ?? []) as { currency_code: string; rate_to_usd: number }[]) globalPresets[p.currency_code] = Number(p.rate_to_usd);
  const reportRates = (r.exchange_rates ?? {}) as Record<string, number>;
  const effectiveRates: Record<string, number> = { ...globalPresets, ...reportRates };

  const budgetMax      = r.budget_max ? Number(r.budget_max) : null;
  const budgetCurrency = r.budget_currency ?? "USD";
  const hasRates       = Object.keys(effectiveRates).length > 0;
  const totalCalculado = nonRejectedExpenses.reduce((acc, e) => acc + Number(e.amount ?? 0), 0);
  const totalInBudgetCurrency = totalInCurrency(
    nonRejectedExpenses.map((e) => ({
      amount: Number(e.amount),
      currency: e.currency ?? "UYU",
    })),
    budgetCurrency,
    effectiveRates,
  );
  const budgetOverrun  = !!(
    budgetMax &&
    totalInBudgetCurrency !== null &&
    totalInBudgetCurrency > budgetMax
  );

  const backHref = isOwner ? "/dashboard/reports" : isChusma ? "/dashboard/chusma-view" : "/dashboard/reports";

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="space-y-4">
        <BackButton href={backHref} />

        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-[var(--color-text-primary)] sm:text-xl">
                {r.title ?? (
                  <>
                    {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                    {" – "}
                    {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                  </>
                )}
              </h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold ${
                isOpen ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-[var(--color-primary)]"
              }`}>
                {isOpen ? "Abierta" : "Cerrada"}
              </span>
              <span className="inline-flex items-center rounded-full bg-[#f5f1f8] px-2.5 py-0.5 text-[0.65rem] font-semibold text-[var(--color-text-muted)]">
                {WORKFLOW_LABELS[workflowStatus] ?? workflowStatus}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60" aria-hidden="true">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <span>
                {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                {" – "}
                {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            {r.notes && (
              <p className="mt-1.5 break-words text-sm italic text-[var(--color-text-muted)]">{r.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/reports/export?report_id=${r.id}`}
          className="rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[#f5f1f8]"
        >
          Exportar Excel
        </a>
        {canSupervisorAct && (
          <div className="flex gap-2 ml-auto">
            <form action={returnReportAction}>
              <input type="hidden" name="reportId" value={r.id} />
              <button
                type="submit"
                className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
              >
                Devolver para corrección
              </button>
            </form>
            <form action={approveReportAction}>
              <input type="hidden" name="reportId" value={r.id} />
              <button
                type="submit"
                disabled={!allExpensesApproved}
                className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title={
                  !allExpensesApproved
                    ? "Debes aprobar todos los gastos individuales primero"
                    : "Aprobar Rendición Completa"
                }
              >
                {allExpensesApproved ? "Aprobar Rendición" : "Aprobar gastos pendientes..."}
              </button>
            </form>
          </div>
        )}
        {isOwner && isOpen && canEmployeeEditReport && (
          <Link href={`/dashboard/expenses/new?reportId=${r.id}`} className="btn-primary btn-shimmer w-full text-center text-sm sm:ml-auto sm:w-auto">
            + Agregar gasto
          </Link>
        )}
        {isOwner && canEmployeeEditReport && (
          <form action={submitReportAction} className="w-full sm:ml-auto sm:w-auto">
            <input type="hidden" name="reportId" value={r.id} />
            <SubmitReportButton />
          </form>
        )}
      </div>

      {/* Stats + presupuesto en tiempo real */}
      <RealtimeBudgetSection
        reportId={r.id}
        budgetMax={budgetMax}
        budgetCurrency={budgetCurrency}
        savedRates={effectiveRates}
        initialExpenses={nonRejectedExpenses.map((e) => ({
          id:       e.id,
          amount:   Number(e.amount ?? 0),
          currency: e.currency ?? "UYU",
          status:   e.status ?? "pending",
        }))}
      />

      {/* Información de pago */}
      {workflowStatus === "paid" && (
        <div className="card w-full overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-[#f0ecf4] bg-blue-50/50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Pago registrado</h2>
              <p className="text-[0.65rem] text-[var(--color-text-muted)]">Esta rendición fue pagada correctamente.</p>
            </div>
          </div>
          <div className="grid gap-px bg-[#f0ecf4] sm:grid-cols-3">
            <div className="bg-white px-4 py-3">
              <p className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Fecha de pago
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {r.payment_date
                  ? new Date(r.payment_date + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" })
                  : "—"}
              </p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Monto pagado
              </p>
              <p className="mt-1 text-sm font-bold text-blue-700">
                {typeof r.amount_paid === "number"
                  ? `${budgetCurrency} ${fmt(Number(r.amount_paid))}`
                  : "—"}
              </p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                Medio de pago
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-[var(--color-text-primary)]">{r.payment_destination || "—"}</p>
            </div>
          </div>
          {r.payment_receipt_url ? (
            <div className="border-t border-[#f0ecf4] px-4 py-3">
              <a
                href={r.payment_receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>
                Ver comprobante
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          ) : (
            <div className="border-t border-[#f0ecf4] px-4 py-3">
              <p className="text-xs text-[var(--color-text-muted)]">Sin comprobante adjunto.</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de gastos */}
      <div className="card overflow-hidden">
        <div className="border-b border-[#f0ecf4] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Gastos</h2>
        </div>

        {expenses && expenses.length > 0 ? (
          <>
            {/* Cards — mobile */}
            <div className="md:hidden">
              {expenseList.map((expense) => {
                const usd = toUSD(Number(expense.amount), expense.currency ?? "UYU", effectiveRates);
                return (
                  <div key={expense.id} className="border-b border-[#f0ecf4] last:border-b-0">
                    <Link
                      href={`/dashboard/expenses/${expense.id}?returnTo=/dashboard/reports/${r.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#faf7fd] active:bg-[#f0ecf4] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {expense.description}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {CATEGORY_LABELS[expense.category] ?? expense.category}
                          {" · "}
                          {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-bold">
                          {fmt(Number(expense.amount))}{" "}
                          <span className="text-xs font-normal text-[var(--color-text-muted)]">{expense.currency ?? "UYU"}</span>
                        </span>
                        {usd !== null && (expense.currency ?? "UYU") !== "USD" && (
                          <span className="text-[0.65rem] font-semibold text-emerald-700">≈ USD {fmt(usd)}</span>
                        )}
                        <ExpenseStatusBadge status={expense.status ?? "pending"} />
                      </div>
                    </Link>
                    {expense.status === "rejected" && expense.rejection_reason && (
                      <p className="mx-4 mb-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                        Motivo de rechazo: {expense.rejection_reason}
                      </p>
                    )}
                    {expense.status === "reviewing" && expense.admin_notes && (
                      <div className="mx-4 mb-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                        <p className="text-[0.65rem] font-semibold text-blue-600 mb-0.5">Comentario del admin</p>
                        <p className="text-xs text-blue-700">{expense.admin_notes}</p>
                      </div>
                    )}

                    {canEmployeeEditReport &&
                      (expense.status === "reviewing" || expense.status === "rejected") && (
                        <div className="mx-4 mb-3 mt-1 flex justify-center">
                          <Link
                            href={`/dashboard/expenses/${expense.id}/edit`}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600 sm:w-auto"
                          >
                            Corregir gasto
                          </Link>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>

            {/* Tabla — desktop */}
            <table className="hidden min-w-full text-left text-sm md:table">
              <thead className="bg-[#f5f1f8] text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium text-right">Monto original</th>
                  {hasRates && <th className="px-4 py-3 font-medium text-right">USD</th>}
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {expenseList.map((expense) => {
                  const usd = toUSD(Number(expense.amount), expense.currency ?? "UYU", effectiveRates);
                  return (
                    <tr key={expense.id} className="border-t border-[#f0ecf4] hover:bg-[#faf7fd] transition-colors">
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/dashboard/expenses/${expense.id}?returnTo=/dashboard/reports/${r.id}`}
                          className="text-sm font-medium hover:text-[var(--color-primary)]"
                        >
                          {expense.description}
                        </Link>
                        <p className="text-[0.7rem] text-[var(--color-text-muted)]">
                          {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY")}
                        </p>
                        {expense.status === "rejected" && expense.rejection_reason && (
                          <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                            Motivo de rechazo: {expense.rejection_reason}
                          </p>
                        )}
                        {expense.status === "reviewing" && expense.admin_notes && (
                          <p className="mt-1 text-[0.68rem] text-blue-600 italic">
                            ↺ {expense.admin_notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-muted)]">
                        {CATEGORY_LABELS[expense.category] ?? expense.category}
                      </td>
                      <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-primary)]">
                        {expense.merchant_name || "-"}
                      </td>
                      <td className="px-4 py-3 align-middle text-right text-sm font-semibold whitespace-nowrap">
                        {fmt(Number(expense.amount))}{" "}
                        <span className="text-xs font-normal text-[var(--color-text-muted)]">{expense.currency ?? "UYU"}</span>
                      </td>
                      {hasRates && (
                        <td className="px-4 py-3 align-middle text-right text-sm font-semibold whitespace-nowrap text-emerald-700">
                          {usd !== null ? `USD ${fmt(usd)}` : <span className="text-[var(--color-text-muted)] font-normal italic text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 align-middle">
                        <ExpenseStatusBadge status={expense.status ?? "pending"} />
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        {canEmployeeEditReport &&
                        (expense.status === "reviewing" ||
                          expense.status === "rejected") ? (
                          <Link
                            href={`/dashboard/expenses/${expense.id}/edit`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                          >
                            Corregir
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/expenses/${expense.id}?returnTo=/dashboard/reports/${r.id}`}
                            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                          >
                            Ver
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#e5e2ea] bg-[#fdfbff]">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase text-[var(--color-text-muted)]">Total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[var(--color-text-muted)]">
                    —
                  </td>
                  {hasRates && (
                    <td className="px-4 py-3 text-right text-sm font-bold text-[var(--color-primary)]">
                      {totalInBudgetCurrency !== null
                        ? `${budgetCurrency} ${fmt(totalInBudgetCurrency)}`
                        : "—"}
                    </td>
                  )}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>

            {/* Total mobile */}
            <div className="flex items-center justify-between border-t-2 border-[#e5e2ea] bg-[#fdfbff] px-4 py-3 md:hidden">
              <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Total</span>
              <span className={`text-sm font-bold ${budgetOverrun ? "text-red-600" : "text-[var(--color-primary)]"}`}>
                {totalInBudgetCurrency !== null
                  ? `${budgetCurrency} ${fmt(totalInBudgetCurrency)}`
                  : `${fmt(totalCalculado)} (orig.)`}
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f1f8]">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)]" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M12 18v-6" />
                <path d="M9 15h6" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin gastos aún</p>
              <p className="text-xs text-[var(--color-text-muted)]">Agregá tu primer gasto para comenzar.</p>
            </div>
            {isOwner && isOpen && canEmployeeEditReport && (
              <Link href={`/dashboard/expenses/new?reportId=${r.id}`} className="btn-primary btn-shimmer text-sm">
                Agregar primer gasto
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
