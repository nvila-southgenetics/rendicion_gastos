import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { OpenReportCard } from "@/components/dashboard/OpenReportCard";
import type { Tables } from "@/types/database";

type Expense      = Tables<"expenses">;
type WeeklyReport = Tables<"weekly_reports">;

const CATEGORY_LABELS: Record<string, string> = {
  transport:       "Transporte",
  food:            "Comida y bebida",
  accommodation:   "Alojamiento",
  fuel:            "Combustible",
  communication:   "Comunicación",
  office_supplies: "Insumos",
  entertainment:   "Entretenimiento",
  other:           "Otros",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const userId = session.user.id;

  const [{ data: expenses }, { data: reports }, { data: profile }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("weekly_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "open")
      .order("week_start", { ascending: false })
      .limit(3),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single(),
  ]);

  const openReport: WeeklyReport | undefined = reports?.[0];
  const totalOpen = openReport?.total_amount != null ? Number(openReport.total_amount) : null;
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-5">
      {/* Saludo */}
      <div>
        <h1 className="page-title">Hola, {firstName} 👋</h1>
        <p className="page-subtitle">Resumen de tus gastos recientes.</p>
      </div>

      {/* Rendición abierta activa */}
      {openReport ? (
        <OpenReportCard
          reportId={openReport.id}
          title={openReport.title}
          totalOpen={totalOpen}
          weekStart={openReport.week_start}
          weekEnd={openReport.week_end}
        />
      ) : (
        <div className="card flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              No tenés rendiciones abiertas
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Creá una para empezar a cargar gastos.
            </p>
          </div>
          <Link href="/dashboard/reports/new" className="btn-primary text-xs py-2 px-4 shrink-0">
            Crear
          </Link>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/dashboard/reports"
          className="card flex flex-col items-center gap-2 p-4 text-center active:scale-[0.97] transition-transform"
        >
          <span className="text-2xl">📋</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Rendiciones</span>
        </Link>
        <Link
          href="/dashboard/expenses"
          className="card flex flex-col items-center gap-2 p-4 text-center active:scale-[0.97] transition-transform"
        >
          <span className="text-2xl">🧾</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Histórico</span>
        </Link>
      </div>

      {/* Últimos gastos */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f0ecf4] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Últimos gastos</h2>
          <Link href="/dashboard/expenses" className="text-xs font-medium text-[var(--color-primary)]">
            Ver todos
          </Link>
        </div>
        {expenses && expenses.length > 0 ? (
          <div className="divide-y divide-[#f0ecf4]">
            {(expenses as Expense[]).map((expense) => (
              <Link
                key={expense.id}
                href={`/dashboard/expenses/${expense.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#faf7fd] active:bg-[#f0ecf4] transition-colors"
              >
                <div className="min-w-0">
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
                  <span className="text-sm font-semibold">
                    {Number(expense.amount).toLocaleString("es-UY", { minimumFractionDigits: 2 })}{" "}
                    <span className="text-xs font-normal text-[var(--color-text-muted)]">
                      {expense.currency ?? "UYU"}
                    </span>
                  </span>
                  <ExpenseStatusBadge status={expense.status ?? "pending"} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">🧾</span>
            <p className="text-sm text-[var(--color-text-muted)]">Aún no tenés gastos registrados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
