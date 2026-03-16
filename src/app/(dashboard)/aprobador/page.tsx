import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLE_LABELS: Record<string, string> = {
  employee:   "Empleado",
  seller:     "Vendedor",
  aprobador:  "Aprobador",
};

export default async function AprobadorHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", session.user.id).single();
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
    .select("id, title, week_start, week_end, status, user_id, budget_max, expenses(id, status)")
    .in("user_id", employeeIds)
    .order("created_at", { ascending: false });

  // Group reports by employee
  const reportsByEmployee: Record<string, typeof reports> = {};
  for (const r of reports ?? []) {
    if (!reportsByEmployee[r.user_id]) reportsByEmployee[r.user_id] = [];
    reportsByEmployee[r.user_id]!.push(r);
  }

  return (
    <div className="space-y-5">
      <div>
          <h1 className="page-title">Aprobaciones</h1>
        <p className="page-subtitle">
          Aprobás rendiciones de {employees.length} {employees.length === 1 ? "persona" : "personas"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {employees.map((emp) => {
          const empReports = reportsByEmployee[emp.id] ?? [];
          const openReports = empReports.filter((r) => r.status === "open").length;
          const pendingExpenses = empReports.flatMap((r) =>
            (r.expenses as Array<{ id: string; status: string | null }> ?? [])
              .filter((e) => e.status === "pending")
          ).length;

          return (
            <Link
              key={emp.id}
              href={`/dashboard/aprobador/employee/${emp.id}`}
              className="card p-4 space-y-3 hover:border-[var(--color-primary)]/30 hover:bg-[#f5f1f8] transition-colors"
            >
              {/* Employee header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                  {emp.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                    {emp.full_name}
                  </p>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)] truncate">{emp.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[0.65rem] font-medium text-blue-700">
                  {ROLE_LABELS[emp.role] ?? emp.role}
                </span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#f5f1f8] p-2">
                  <p className="text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">Rendiciones</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)]">{empReports.length}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <p className="text-[0.6rem] font-semibold uppercase text-emerald-600">Abiertas</p>
                  <p className="text-base font-bold text-emerald-700">{openReports}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <p className="text-[0.6rem] font-semibold uppercase text-amber-600">Pendientes</p>
                  <p className="text-base font-bold text-amber-700">{pendingExpenses}</p>
                </div>
              </div>

              {/* Recent reports */}
              {empReports.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">
                    Rendiciones recientes
                  </p>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)]">
                    {empReports.length} en total, {openReports} abiertas, {pendingExpenses} gastos pendientes.
                  </p>
                </div>
              )}

              {empReports.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-2">
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
