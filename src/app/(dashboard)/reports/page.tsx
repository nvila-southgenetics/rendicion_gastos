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
        ? "Cerrada / Aprobada"
        : ws === "paid"
          ? "Pagada"
          : ws === "needs_correction"
            ? "Devuelta al empleado"
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
            : "bg-gray-100 text-gray-700";

  const closed = status === "closed";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${badgeClasses}`}
      >
        {label}
      </span>
      <span className="text-[0.6rem] text-[var(--color-text-muted)]">
        {closed ? "Estado interno: cerrada" : "Estado interno: abierta"}
      </span>
    </div>
  );
}

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("*, expenses(count)")
    .eq("user_id", session.user.id)
    .order("week_start", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Rendiciones</h1>
          <p className="page-subtitle">Administrá tus períodos de gastos.</p>
        </div>
        <Link href="/dashboard/reports/new" className="btn-primary text-sm">
          + Nueva rendición
        </Link>
      </div>

      {reports && reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((report: WeeklyReport & { expenses: { count: number }[] }) => {
            const expenseCount = report.expenses?.[0]?.count ?? 0;
            const startDate = new Date(report.week_start + "T12:00:00");
            const endDate   = new Date(report.week_end   + "T12:00:00");
            return (
              <Link
                key={report.id}
                href={`/dashboard/reports/${report.id}`}
                className="card flex items-center justify-between gap-4 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-lg">
                    📋
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {report.title ?? (
                        <>
                          {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                          {" — "}
                          {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {startDate.toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                      {" – "}
                      {endDate.toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {expenseCount} {expenseCount === 1 ? "gasto" : "gastos"} ·{" "}
                      {Number(report.total_amount ?? 0).toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      UYU
                    </p>
                    {report.notes && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)] truncate italic">
                        {report.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ReportStatusBadge
                    workflowStatus={report.workflow_status}
                    status={report.status}
                  />
                  <span className="text-[var(--color-text-muted)]">›</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="text-4xl">📋</div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Todavía no tenés rendiciones
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Creá una nueva rendición para empezar a cargar gastos.
          </p>
          <Link href="/dashboard/reports/new" className="btn-primary mt-2 text-sm">
            Crear primera rendición
          </Link>
        </div>
      )}
    </div>
  );
}
