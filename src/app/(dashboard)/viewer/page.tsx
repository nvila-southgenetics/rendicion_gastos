import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLE_LABELS: Record<string, string> = {
  employee:   "Empleado",
  seller:     "Vendedor",
  supervisor: "Supervisor",
  chusmas:    "Chusmas",
};

export default async function ViewerHomePage() {
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
  if (me?.role !== "chusmas" && me?.role !== "admin") redirect("/dashboard");

  // Get employees this viewer can see (IDs from assignments, then fetch profiles separately)
  const { data: assignments } = await supabase
    .from("viewer_assignments")
    .select("employee_id")
    .eq("viewer_id", session.user.id);

  const employeeIds = (assignments ?? []).map((a) => a.employee_id as string).filter(Boolean);

  if (employeeIds.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="page-title">Ver rendiciones</h1>
          <p className="page-subtitle">Empleados asignados para solo lectura.</p>
        </div>
        <div className="card p-10 text-center space-y-2">
          <p className="text-2xl">👀</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            No tenés empleados asignados aún. El administrador debe asignarte qué rendiciones podés ver.
          </p>
        </div>
      </div>
    );
  }

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department")
    .in("id", employeeIds);

  const employeeList =
    (employees ?? []) as Array<{
      id: string;
      full_name: string;
      email: string;
      role: string;
      department: string | null;
    }>;

  if (employeeList.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="page-title">Ver rendiciones</h1>
          <p className="page-subtitle">Empleados asignados para solo lectura.</p>
        </div>
        <div className="card p-10 text-center space-y-2">
          <p className="text-2xl">👀</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            No tenés empleados asignados aún. El administrador debe asignarte qué rendiciones podés ver.
          </p>
        </div>
      </div>
    );
  }

  // Get reports for all viewable employees
  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, title, week_start, week_end, status, user_id, expenses(id, status)")
    .in("user_id", employeeIds)
    .order("created_at", { ascending: false });

  const reportsByEmployee: Record<string, typeof reports> = {};
  for (const r of reports ?? []) {
    if (!reportsByEmployee[r.user_id]) reportsByEmployee[r.user_id] = [];
    reportsByEmployee[r.user_id]!.push(r);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Ver rendiciones</h1>
        <p className="page-subtitle">
          Podés ver las rendiciones de {employeeList.length}{" "}
          {employeeList.length === 1 ? "persona asignada" : "personas asignadas"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {employeeList.map((emp) => {
          const empReports = reportsByEmployee[emp.id] ?? [];
          const openReports = empReports.filter((r) => r.status === "open").length;
          const pendingExpenses = empReports.flatMap((r) =>
            (r.expenses as Array<{ id: string; status: string | null }> ?? []).filter(
              (e) => e.status === "pending",
            ),
          ).length;

          return (
            <div key={emp.id} className="card p-4 space-y-3">
              {/* Employee header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                  {emp.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                    {emp.full_name}
                  </p>
                  <p className="text-[0.65rem] text-[var(--color-text-muted)] truncate">
                    {emp.email}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[0.65rem] font-medium text-gray-700">
                  {ROLE_LABELS[emp.role] ?? emp.role}
                </span>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[#f5f1f8] p-2">
                  <p className="text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">
                    Rendiciones
                  </p>
                  <p className="text-base font-bold text-[var(--color-text-primary)]">
                    {empReports.length}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2">
                  <p className="text-[0.6rem] font-semibold uppercase text-emerald-600">
                    Abiertas
                  </p>
                  <p className="text-base font-bold text-emerald-700">{openReports}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-2">
                  <p className="text-[0.6rem] font-semibold uppercase text-amber-600">
                    Pendientes
                  </p>
                  <p className="text-base font-bold text-amber-700">{pendingExpenses}</p>
                </div>
              </div>

              {/* Recent reports */}
              {empReports.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)]">
                    Rendiciones recientes
                  </p>
                  {empReports.slice(0, 3).map((r) => {
                    const startDate = new Date(r.week_start + "T12:00:00").toLocaleDateString(
                      "es-UY",
                      { day: "numeric", month: "short" },
                    );
                    const endDate = new Date(r.week_end + "T12:00:00").toLocaleDateString(
                      "es-UY",
                      { day: "numeric", month: "short", year: "numeric" },
                    );
                    const expCount = (r.expenses as Array<{ id: string }> ?? []).length;
                    return (
                      <Link
                        key={r.id}
                        href={`/dashboard/viewer/reports/${r.id}`}
                        className="flex items-center justify-between rounded-lg border border-[#f0ecf4] bg-[#fdfbff] px-3 py-2 hover:border-[var(--color-primary)]/30 hover:bg-[#f5f1f8] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                            {r.title ?? `${startDate} – ${endDate}`}
                          </p>
                          <p className="text-[0.6rem] text-[var(--color-text-muted)]">
                            {expCount} gasto{expCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <span
                          className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                            r.status === "open"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                          }`}
                        >
                          {r.status === "open" ? "Abierta" : "Cerrada"}
                        </span>
                      </Link>
                    );
                  })}
                  {empReports.length > 3 && (
                    <p className="text-center text-[0.65rem] text-[var(--color-text-muted)]">
                      +{empReports.length - 3} más
                    </p>
                  )}
                </div>
              )}

              {empReports.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-2">
                  Sin rendiciones aún.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

