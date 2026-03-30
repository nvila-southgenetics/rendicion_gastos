import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type WeeklyReport = Tables<"weekly_reports">;

function ReportStatusBadge({
  workflowStatus,
  status,
}: {
  workflowStatus: string | null;
  status: string;
}) {
  const ws = (workflowStatus ?? "draft") as
    | "draft"
    | "submitted"
    | "needs_correction"
    | "approved"
    | "paid";

  const label =
    ws === "submitted"
      ? "En revisión"
      : ws === "approved"
        ? "Aprobada"
        : ws === "paid"
          ? "Pagada"
          : ws === "needs_correction"
            ? "Devuelta"
            : status === "closed"
              ? "Cerrada"
              : "Borrador";

  const badgeClasses =
    ws === "submitted"
      ? "bg-amber-100 text-amber-700"
      : ws === "approved"
        ? "bg-emerald-100 text-emerald-700"
        : ws === "paid"
          ? "bg-blue-100 text-blue-700"
          : ws === "needs_correction"
            ? "bg-rose-100 text-rose-700"
            : status === "closed"
              ? "bg-purple-100 text-[var(--color-primary)]"
              : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${badgeClasses}`}
    >
      {label}
    </span>
  );
}

export default async function ReportsPage() {
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

  const baseQuery = supabase
    .from("weekly_reports")
    .select("*, expenses(count)")
    .order("week_start", { ascending: false });

  const { data: reports } = await baseQuery.eq("user_id", session.user.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Rendiciones</h1>
          <p className="page-subtitle">Administrá tus períodos de gastos.</p>
        </div>
        <Link href="/dashboard/reports/new" className="btn-primary btn-shimmer w-full text-center text-sm sm:w-auto">
          + Nueva rendición
        </Link>
      </div>

      {reports && reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map((report: WeeklyReport & { expenses: { count: number }[] }) => {
            const expenseCount = report.expenses?.[0]?.count ?? 0;
            const startDate = new Date(report.week_start + "T12:00:00");
            const endDate   = new Date(report.week_end   + "T12:00:00");
            return (
              <Link
                key={report.id}
                href={`/dashboard/reports/${report.id}`}
                className="card group flex w-full items-center gap-3 p-3 transition-all hover:shadow-md sm:gap-4 sm:p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-[var(--color-primary)] transition-colors group-hover:bg-purple-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 18v-4"/><path d="M14 18v-2"/></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                      {report.title ?? (
                        <>
                          {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                          {" — "}
                          {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                        </>
                      )}
                    </p>
                    <ReportStatusBadge
                      workflowStatus={report.workflow_status}
                      status={report.status}
                    />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-xs text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                      {" – "}
                      {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span>·</span>
                    <span>{expenseCount} {expenseCount === 1 ? "gasto" : "gastos"}</span>
                    <span>·</span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {Number(report.total_amount ?? 0).toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      UYU
                    </span>
                  </div>
                  {report.notes && (
                    <p className="mt-0.5 truncate text-[0.7rem] italic text-[var(--color-text-muted)]">
                      {report.notes}
                    </p>
                  )}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-[var(--color-primary)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Todavía no tenés rendiciones
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Creá una nueva rendición para empezar a cargar gastos.
          </p>
          <Link href="/dashboard/reports/new" className="btn-primary btn-shimmer mt-2 text-sm">
            Crear primera rendición
          </Link>
        </div>
      )}
    </div>
  );
}
