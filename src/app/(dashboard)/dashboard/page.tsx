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
    <div className="w-full max-w-full space-y-4 overflow-x-hidden box-border">
      <div className="min-w-0">
        <h1 className="page-title truncate">Hola, {firstName} 👋</h1>
        <p className="page-subtitle">Resumen de tus gastos recientes.</p>
      </div>

      {openReport ? (
        <OpenReportCard
          reportId={openReport.id}
          title={openReport.title}
          totalOpen={totalOpen}
          weekStart={openReport.week_start}
          weekEnd={openReport.week_end}
        />
      ) : (
        <div className="card flex w-full max-w-full flex-col gap-3 p-4 max-[430px]:p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 max-w-full">
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              No tenés rendiciones abiertas
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Creá una para empezar a cargar gastos.
            </p>
          </div>
          <Link
            href="/dashboard/reports/new"
            className="btn-primary w-full shrink-0 text-center text-xs py-2 px-4 sm:w-auto"
          >
            Crear
          </Link>
        </div>
      )}

      <div className="grid w-full max-w-full grid-cols-2 gap-2">
        <Link
          href="/dashboard/reports"
          className="card flex min-w-0 flex-col items-center gap-1.5 px-2 py-3 text-center active:scale-[0.97] transition-transform"
        >
          <span className="text-xl">📋</span>
          <span className="max-w-full truncate text-xs font-semibold text-[var(--color-text-primary)]">
            Rendiciones
          </span>
        </Link>
        <Link
          href="/dashboard/expenses"
          className="card flex min-w-0 flex-col items-center gap-1.5 px-2 py-3 text-center active:scale-[0.97] transition-transform"
        >
          <span className="text-xl">🧾</span>
          <span className="max-w-full truncate text-xs font-semibold text-[var(--color-text-primary)]">
            Histórico
          </span>
        </Link>
      </div>

      <div className="card w-full max-w-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[#f0ecf4] px-4 py-3 max-[430px]:px-3">
          <h2 className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
            Últimos gastos
          </h2>
          <Link
            href="/dashboard/expenses"
            className="shrink-0 whitespace-nowrap text-xs font-medium text-[var(--color-primary)]"
          >
            Ver todos
          </Link>
        </div>
        {expenses && expenses.length > 0 ? (
          <div className="divide-y divide-[#f0ecf4]">
            {(expenses as Expense[]).map((expense) => (
              <Link
                key={expense.id}
                href={`/dashboard/expenses/${expense.id}`}
                className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-[#faf7fd] active:bg-[#f0ecf4] max-[430px]:px-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)] max-[430px]:text-xs">
                    {expense.description}
                  </p>
                  <p className="truncate text-xs text-[var(--color-text-muted)] max-[430px]:text-[0.65rem]">
                    {CATEGORY_LABELS[expense.category] ?? expense.category}
                    {" · "}
                    {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="whitespace-nowrap text-sm font-semibold max-[430px]:text-xs">
                    {Number(expense.amount).toLocaleString("es-UY", { minimumFractionDigits: 2 })}
                    <span className="ml-0.5 text-xs font-normal text-[var(--color-text-muted)] max-[540px]:hidden">
                      {expense.currency ?? "UYU"}
                    </span>
                  </span>
                  <div className="max-[540px]:hidden">
                    <ExpenseStatusBadge status={expense.status ?? "pending"} />
                  </div>
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
