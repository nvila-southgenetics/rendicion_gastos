import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { ExpenseAdminActions } from "@/components/expenses/ExpenseAdminActions";
import { CloseReportButton } from "@/components/reports/CloseReportButton";
import { toUSD, totalInUSD, fmt } from "@/lib/currency";

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

interface Props { params: Promise<{ id: string }> }

export default async function SupervisorReportDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", session.user.id).single();
  if (me?.role !== "supervisor" && me?.role !== "admin") redirect("/dashboard");

  // Verify supervisor can access this report
  const { data: report } = await supabase
    .from("weekly_reports")
    .select("*, profiles!weekly_reports_user_id_fkey(full_name, email, department)")
    .eq("id", id)
    .single();

  if (!report) notFound();

  // If supervisor, verify the report's owner is one of their supervised employees
  if (me?.role === "supervisor") {
    const { data: assignment } = await supabase
      .from("supervision_assignments")
      .select("id")
      .eq("supervisor_id", session.user.id)
      .eq("employee_id", report.user_id)
      .maybeSingle();
    if (!assignment) redirect("/dashboard/supervisor");
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("report_id", id)
    .order("created_at", { ascending: false });

  const { data: presets } = await supabase
    .from("exchange_rate_presets").select("currency, rate");

  const owner = report.profiles as { full_name: string; email: string; department: string | null } | null;
  const expenseList = expenses ?? [];

  const globalPresets: Record<string, number> = {};
  for (const p of presets ?? []) globalPresets[p.currency] = Number(p.rate);
  const reportRates    = (report.exchange_rates ?? {}) as Record<string, number>;
  const effectiveRates = { ...globalPresets, ...reportRates };

  const budgetMax    = report.budget_max ? Number(report.budget_max) : null;
  const totalUSD     = totalInUSD(expenseList.map((e) => ({ amount: Number(e.amount), currency: e.currency ?? "UYU" })), effectiveRates);
  const hasRates     = Object.keys(effectiveRates).length > 0;
  const budgetOverrun = !!(budgetMax && totalUSD !== null && totalUSD > budgetMax);

  const pendingCount   = expenseList.filter((e) => e.status === "pending").length;
  const reviewingCount = expenseList.filter((e) => e.status === "reviewing").length;
  const approvedCount  = expenseList.filter((e) => e.status === "approved").length;
  const rejectedCount  = expenseList.filter((e) => e.status === "rejected").length;

  const startDate = new Date(report.week_start + "T12:00:00");
  const endDate   = new Date(report.week_end   + "T12:00:00");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link href="/dashboard/supervisor" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
          ← Supervisar
        </Link>
        <h1 className="page-title mt-1">
          {report.title ?? (
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
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          <span className="font-semibold text-[var(--color-text-primary)]">{owner?.full_name ?? "—"}</span>
          {owner?.email && ` · ${owner.email}`}
          {owner?.department && ` · ${owner.department}`}
        </p>
      </div>

      {/* Status + budget + acciones de supervisor */}
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
        {report.status === "open" && (
          <div className="ml-auto">
            <CloseReportButton
              reportId={report.id}
              currentStatus={report.status as "open" | "closed"}
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pendientes",  value: pendingCount,   color: "text-amber-600" },
          { label: "En revisión", value: reviewingCount, color: "text-blue-600" },
          { label: "Aprobados",   value: approvedCount,  color: "text-emerald-600" },
          { label: "Rechazados",  value: rejectedCount,  color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {budgetMax && totalUSD !== null && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase text-[var(--color-text-muted)]">Presupuesto</span>
            <span className={`font-bold ${budgetOverrun ? "text-red-600" : "text-[var(--color-text-primary)]"}`}>
              USD {fmt(totalUSD)} / USD {fmt(budgetMax)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f0ecf4]">
            <div
              className={`h-full rounded-full transition-all ${budgetOverrun ? "bg-red-500" : budgetMax && totalUSD / budgetMax >= 0.8 ? "bg-amber-500" : "bg-[var(--color-secondary)]"}`}
              style={{ width: `${Math.min((totalUSD / budgetMax) * 100, 100)}%` }}
            />
          </div>
          <p className="text-right text-[0.65rem] text-[var(--color-text-muted)]">
            {((totalUSD / budgetMax) * 100).toFixed(1)}% del presupuesto utilizado
          </p>
        </div>
      )}

      {/* Expense list */}
      <div className="card overflow-hidden">
        <div className="border-b border-[#f0ecf4] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Gastos ({expenseList.length})
          </h2>
        </div>

        {expenseList.length > 0 ? (
          <div className="divide-y divide-[#f0ecf4]">
            {expenseList.map((expense) => {
              const usdAmount = toUSD(Number(expense.amount), expense.currency ?? "UYU", effectiveRates);
              const isUSD     = (expense.currency ?? "UYU") === "USD";
              return (
                <div key={expense.id} className="p-4 hover:bg-[#fdfbff] transition-colors">
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
                          <span>{new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY")}</span>
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
                    <div className="shrink-0">
                      <ExpenseAdminActions
                        expenseId={expense.id}
                        currentStatus={expense.status ?? "pending"}
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
