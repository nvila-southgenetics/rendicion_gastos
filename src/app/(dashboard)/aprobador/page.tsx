import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";

const ROLE_LABELS: Record<string, string> = {
  employee:   "Empleado",
  seller:     "Vendedor",
  aprobador:  "Aprobador",
};

export default async function AprobadorHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);
  if (me?.role !== "aprobador" && me?.role !== "admin") redirect("/dashboard");

  // Get supervised employees
  const { data: assignments } = await supabase
    .from("supervision_assignments")
    .select("employee_id, profiles!supervision_assignments_employee_id_fkey(id, full_name, email, role, department)")
    .eq("supervisor_id", session.user.id);

  const employees = (assignments ?? []).map((a) => a.profiles as {
    id: string; full_name: string; email: string; role: string; department: string | null;
  }).filter(Boolean);

  if (employees.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="page-title">Aprobaciones</h1>
          <p className="page-subtitle">Tus empleados asignados para aprobar.</p>
        </div>
        <div className="card p-10 text-center space-y-2">
          <p className="text-2xl">👁</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            No tenés empleados asignados aún. El administrador debe asignarte empleados a supervisar.
          </p>
        </div>
      </div>
    );
  }

  // Get reports for all supervised employees
  const employeeIds = employees.map((e) => e.id);
  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, title, week_start, week_end, status, workflow_status, user_id, budget_max, expenses(id, status)")
    .in("user_id", employeeIds)
    .in("workflow_status", ["submitted", "needs_correction", "approved", "paid"])
    .order("created_at", { ascending: false });

  // Group reports by employee
  const reportsByEmployee: Record<string, typeof reports> = {};
  for (const r of reports ?? []) {
    if (!reportsByEmployee[r.user_id]) reportsByEmployee[r.user_id] = [];
    reportsByEmployee[r.user_id]!.push(r);
  }

  return (
    <div className="w-full max-w-full space-y-5">
      <div className="min-w-0">
        <h1 className="page-title">Aprobaciones</h1>
        <p className="page-subtitle">
          Aprobás rendiciones de {employees.length} {employees.length === 1 ? "persona" : "personas"}.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        {employees.map((emp) => {
          const empReports = reportsByEmployee[emp.id] ?? [];
          const paidReports = empReports.filter((r) => (r as any).workflow_status === "paid").length;
          const approvedReports = empReports.filter(
            (r) => (r as any).workflow_status === "approved",
          ).length;
          const pendingReports = empReports.filter((r) => {
            const ws = ((r as any).workflow_status ?? "draft") as string;
            return ws === "submitted" || ws === "needs_correction";
          }).length;

          return (
            <Link
              key={emp.id}
              href={`/dashboard/aprobador/employee/${emp.id}`}
              className="card w-full p-4 space-y-3 hover:bg-[#f5f1f8] transition-colors"
            >
              {/* Employee header */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700 sm:h-10 sm:w-10">
                  {emp.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {emp.full_name}
                  </p>
                  <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">{emp.email}</p>
                </div>
                <span className="hidden shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.65rem] font-medium text-blue-700 sm:inline-flex">
                  {ROLE_LABELS[emp.role] ?? emp.role}
                </span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-1.5 text-center sm:gap-2">
                <div className="rounded-lg bg-blue-50 px-1 py-2 sm:p-2">
                  <p className="truncate text-[0.55rem] font-semibold uppercase text-blue-600 sm:text-[0.6rem]">Pagadas</p>
                  <p className="text-sm font-bold text-blue-700 sm:text-base">{paidReports}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-1 py-2 sm:p-2">
                  <p className="truncate text-[0.55rem] font-semibold uppercase text-emerald-600 sm:text-[0.6rem]">Aprobadas</p>
                  <p className="text-sm font-bold text-emerald-700 sm:text-base">{approvedReports}</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-1 py-2 sm:p-2">
                  <p className="truncate text-[0.55rem] font-semibold uppercase text-amber-600 sm:text-[0.6rem]">Pendientes</p>
                  <p className="text-sm font-bold text-amber-700 sm:text-base">{pendingReports}</p>
                </div>
              </div>

              {/* Recent reports */}
              {empReports.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">
                    Resumen
                  </p>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)]">
                    {empReports.length} rendiciones · {paidReports} pagadas · {approvedReports} aprobadas · {pendingReports} pendientes
                  </p>
                </div>
              )}

              {empReports.length === 0 && (
                <p className="py-2 text-center text-xs italic text-[var(--color-text-muted)]">
                  Sin rendiciones aún.
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
