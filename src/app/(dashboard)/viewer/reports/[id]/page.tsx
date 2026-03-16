import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { toUSD, totalInUSD, fmt } from "@/lib/currency";
import { PayReportModal } from "@/components/reports/PayReportModal";

const CATEGORY_LABELS: Record<string, string> = {
  transport: "Transporte",
  food: "Comida y bebida",
  accommodation: "Alojamiento",
  fuel: "Combustible",
  communication: "Comunicación",
  office_supplies: "Insumos de oficina",
  entertainment: "Entretenimiento",
  other: "Otros",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ViewerReportDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  const isPagador = me?.role === "pagador";
  if (me?.role !== "chusmas" && me?.role !== "admin" && !isPagador)
    redirect("/dashboard");

  const [{ data: report }, { data: expenses }, { data: presets }] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("*, profiles!weekly_reports_user_id_fkey(full_name, email, department)")
      .eq("id", id)
      .single(),
    supabase.from("expenses").select("*").eq("report_id", id).order("created_at", { ascending: false }),
    supabase.from("exchange_rate_presets").select("currency, rate"),
  ]);

  if (!report) notFound();

  const owner = report.profiles as {
    full_name: string;
    email: string;
    department: string | null;
  } | null;
  const expenseList = expenses ?? [];

  const globalPresets: Record<string, number> = {};
  for (const p of presets ?? []) globalPresets[p.currency] = Number(p.rate);
  const reportRates = (report.exchange_rates ?? {}) as Record<string, number>;
  const effectiveRates = { ...globalPresets, ...reportRates };

  const budgetMax = report.budget_max ? Number(report.budget_max) : null;
  const totalUSD = totalInUSD(
    expenseList.map((e) => ({ amount: Number(e.amount), currency: e.currency ?? "UYU" })),
    effectiveRates,
  );
  const budgetOverrun = !!(budgetMax && totalUSD !== null && totalUSD > budgetMax);

  const pendingCount = expenseList.filter((e) => e.status === "pending").length;
  const reviewingCount = expenseList.filter((e) => e.status === "reviewing").length;
  const approvedCount = expenseList.filter((e) => e.status === "approved").length;
  const rejectedCount = expenseList.filter((e) => e.status === "rejected").length;

  const totalsByCurrency: Record<string, number> = {};
  for (const e of expenseList) {
    const cur = e.currency ?? "UYU";
    totalsByCurrency[cur] = (totalsByCurrency[cur] ?? 0) + Number(e.amount ?? 0);
  }

  const startDate = new Date(report.week_start + "T12:00:00");
  const endDate = new Date(report.week_end + "T12:00:00");

  const workflowStatus = (report.workflow_status ?? "draft") as
    | "draft"
    | "submitted"
    | "needs_correction"
    | "approved"
    | "paid";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard/viewer"
          className="inline-flex items-center gap-1 rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-[0.7rem] font-semibold text-[var(--color-text-primary)] hover:bg-[#f5f1f8]"
        >
          <span>←</span>
          <span>Volver a ver rendiciones</span>
        </Link>
        <h1 className="page-title mt-1">
          {report.title ?? (
            <>
              {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
              {" – "}
              {endDate.toLocaleDateString("es-UY", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </>
          )}
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
          {" – "}
          {endDate.toLocaleDateString("es-UY", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          <span className="font-semibold text-[var(--color-text-primary)]">
            {owner?.full_name ?? "—"}
          </span>
          {owner?.email && ` · ${owner.email}`}
          {owner?.department && ` · ${owner.department}`}
        </p>
      </div>

      {/* Status + budget (solo lectura) */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${
            report.status === "open"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          }`}
        >
          {report.status === "open" ? "Abierta" : "Cerrada"}
        </span>
        {budgetMax && (
          <span
            className={`text-xs font-semibold ${
              budgetOverrun ? "text-red-600" : "text-[var(--color-text-muted)]"
            }`}
          >
            Presupuesto: {totalUSD !== null ? `USD ${fmt(totalUSD)}` : "—"} / USD {fmt(budgetMax)}
            {budgetOverrun && " ⚠ Excedido"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isPagador && workflowStatus === "approved" && (
            <PayReportModal reportId={report.id} suggestedAmount={totalUSD} />
          )}
        </div>
      </div>

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
                  ? `USD ${fmt(Number(report.amount_paid))}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase text-[var(--color-text-muted)]">
                Destino
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pendientes", value: pendingCount, color: "text-amber-600" },
          { label: "En revisión", value: reviewingCount, color: "text-blue-600" },
          { label: "Aprobados", value: approvedCount, color: "text-emerald-600" },
          { label: "Rechazados", value: rejectedCount, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">
              {s.label}
            </p>
            <p className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de gastos (solo lectura, con acceso al detalle) */}
      <div className="card overflow-hidden">
        <div className="border-b border-[#f0ecf4] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Gastos ({expenseList.length})
          </h2>
          {expenseList.length > 0 && (
            <p className="text-[0.7rem] text-[var(--color-text-muted)]">
              Hacé clic en cualquier gasto para ver el detalle completo en modo solo lectura.
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
                  href={`/dashboard/expenses/${expense.id}?returnTo=/dashboard/viewer/reports/${report.id}`}
                  className="block hover:bg-[#fdfbff] transition-colors"
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {expense.description}
                          </span>
                          <ExpenseStatusBadge status={expense.status ?? "pending"} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                          {expense.expense_date && (
                            <span>
                              {new Date(
                                expense.expense_date + "T12:00:00",
                              ).toLocaleDateString("es-UY")}
                            </span>
                          )}
                          <span>{CATEGORY_LABELS[expense.category] ?? expense.category}</span>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                          <span className="text-sm font-bold text-[var(--color-text-primary)]">
                            {fmt(Number(expense.amount))} {expense.currency ?? "UYU"}
                          </span>
                          {!isUSD && usdAmount !== null && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                              ≈ USD {fmt(usdAmount)}
                            </span>
                          )}
                        </div>
                        {expense.rejection_reason && (
                          <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                            Motivo de rechazo: {expense.rejection_reason}
                          </p>
                        )}
                        {expense.admin_notes && expense.status === "reviewing" && (
                          <p className="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            Nota: {expense.admin_notes}
                          </p>
                        )}
                      </div>
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

