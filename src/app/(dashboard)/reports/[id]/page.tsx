import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { RealtimeBudgetSection } from "@/components/reports/RealtimeBudgetSection";
import { toUSD, totalInCurrency, fmt } from "@/lib/currency";
import type { Tables } from "@/types/database";
import { submitReportAction } from "./submitReportAction";
import { returnReportAction } from "./returnReportAction";
import { approveReportAction } from "./approveReportAction";

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
    supabase.from("exchange_rate_presets").select("currency, rate"),
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
  for (const p of presets ?? []) globalPresets[p.currency] = Number(p.rate);
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

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1 rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-[0.8rem] font-semibold text-[var(--color-text-primary)] hover:bg-[#f5f1f8]"
        >
          <span>←</span>
          <span>Volver a mis rendiciones</span>
        </Link>
        <h1 className="page-title mt-3">
          {r.title ?? (
            <>
              {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
              {" – "}
              {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
            </>
          )}
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
          {" – "}
          {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        {r.notes && <p className="page-subtitle italic">{r.notes}</p>}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${
          isOpen ? "bg-emerald-100 text-emerald-700" : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
        }`}>
          {isOpen ? "Abierta" : "Cerrada"}
        </span>
        <span className="inline-flex items-center rounded-full bg-[#f5f1f8] px-2.5 py-0.5 text-[0.7rem] font-semibold text-[var(--color-text-muted)]">
          {WORKFLOW_LABELS[workflowStatus] ?? workflowStatus}
        </span>
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
          <Link href={`/dashboard/expenses/new?reportId=${r.id}`} className="btn-primary text-sm ml-auto">
            + Agregar gasto
          </Link>
        )}
        {isOwner && canEmployeeEditReport && (
          <form action={submitReportAction} className="ml-auto">
            <input type="hidden" name="reportId" value={r.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)]"
            >
              Cerrar y enviar rendición
            </button>
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

      {/* Información de pago visible para el empleado cuando ya está pagada */}
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
                {r.payment_date
                  ? new Date(r.payment_date + "T12:00:00").toLocaleDateString("es-UY")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
                Monto pagado
              </p>
              <p className="mt-0.5">
                {typeof r.amount_paid === "number"
                  ? `${budgetCurrency} ${fmt(Number(r.amount_paid))}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
                Destino
              </p>
              <p className="mt-0.5">{r.payment_destination || "—"}</p>
            </div>
          </div>
          <div className="pt-1">
            <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
              Comprobante
            </p>
            {r.payment_receipt_url ? (
              <a
                href={r.payment_receipt_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                Ver comprobante ↗
              </a>
            ) : (
              <p className="text-xs text-amber-700">
                Esta rendición figura como pagada, pero no tiene comprobante cargado.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lista de gastos */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f0ecf4] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Gastos</h2>
        {isOwner && isOpen && canEmployeeEditReport && (
            <Link href={`/dashboard/expenses/new?reportId=${r.id}`} className="text-xs font-medium text-[var(--color-primary)]">
              + Agregar
            </Link>
          )}
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
                      <div className="mx-4 mb-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                        <p className="text-[0.65rem] font-semibold text-red-600 mb-0.5">Motivo de rechazo</p>
                        <p className="text-xs text-red-700">{expense.rejection_reason}</p>
                      </div>
                    )}
                    {expense.status === "reviewing" && expense.admin_notes && (
                      <div className="mx-4 mb-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                        <p className="text-[0.65rem] font-semibold text-blue-600 mb-0.5">Comentario del admin</p>
                        <p className="text-xs text-blue-700">{expense.admin_notes}</p>
                      </div>
                    )}

                    {/* Acción "Corregir" visible también en mobile */}
                    {canEmployeeEditReport &&
                      (expense.status === "reviewing" || expense.status === "rejected") && (
                        <div className="mx-4 mb-3 mt-1">
                          <Link
                            href={`/dashboard/expenses/${expense.id}/edit`}
                            className="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold text-amber-600 hover:underline"
                          >
                            Corregir
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
                          <p className="mt-1 text-[0.68rem] text-red-600 italic">
                            ✕ {expense.rejection_reason}
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
                      <td className="px-4 py-3 align-middle text-right">
                        {canEmployeeEditReport &&
                        (expense.status === "reviewing" ||
                          expense.status === "rejected") ? (
                          <Link
                            href={`/dashboard/expenses/${expense.id}/edit`}
                            className="text-xs font-semibold text-amber-600 hover:underline"
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
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="text-3xl">🧾</div>
            <p className="text-sm text-[var(--color-text-muted)]">Sin gastos aún.</p>
            {isOwner && isOpen && canEmployeeEditReport && (
              <Link href={`/dashboard/expenses/new?reportId=${r.id}`} className="btn-primary text-sm">
                Agregar primer gasto
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
