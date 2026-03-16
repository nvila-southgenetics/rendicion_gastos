import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AprobadorEmployeeDetailPage({ params }: Props) {
  const { id: employeeId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  // Verificar que el usuario es aprobador o admin
  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", session.user.id)
    .single();

  if (me?.role !== "aprobador" && me?.role !== "admin") {
    redirect("/dashboard");
  }

  // Verificar que realmente apruebe a este empleado (si no es admin)
  if (me.role === "aprobador") {
    const { data: assignment } = await supabase
      .from("supervision_assignments")
      .select("id")
      .eq("supervisor_id", me.id)
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (!assignment) {
      redirect("/dashboard/aprobador");
    }
  }

  // Datos del empleado
  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, role")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) notFound();

  // Todas las rendiciones del empleado
  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, title, week_start, week_end, status, workflow_status, budget_max, expenses(id, status)")
    .eq("user_id", employeeId)
    .order("created_at", { ascending: false });

  const reportList =
    (reports ?? []) as Array<{
      id: string;
      title: string | null;
      week_start: string;
      week_end: string;
      status: "open" | "closed";
      workflow_status: string | null;
      budget_max: number | null;
      expenses: Array<{ id: string; status: string | null }> | null;
    }>;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/aprobador"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← Volver a aprobaciones
        </Link>
        <h1 className="page-title mt-1">Rendiciones de {employee.full_name}</h1>
        <p className="page-subtitle">
          Podés ver y revisar todas las rendiciones de este empleado.
        </p>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
          {employee.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
            {employee.full_name}
          </p>
          <p className="text-[0.65rem] text-[var(--color-text-muted)] truncate">
            {employee.email}
            {employee.department && ` · ${employee.department}`}
          </p>
        </div>
      </div>

      {reportList.length === 0 ? (
        <div className="card p-10 text-center space-y-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            Este empleado aún no tiene rendiciones.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-[#f0ecf4] px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Rendiciones ({reportList.length})
            </h2>
          </div>
          <div className="divide-y divide-[#f0ecf4]">
            {reportList.map((r) => {
              const startDate = new Date(r.week_start + "T12:00:00").toLocaleDateString(
                "es-UY",
                { day: "numeric", month: "short" },
              );
              const endDate = new Date(r.week_end + "T12:00:00").toLocaleDateString(
                "es-UY",
                { day: "numeric", month: "short", year: "numeric" },
              );
              const expCount = (r.expenses ?? []).length;
              const pendingExpenses = (r.expenses ?? []).filter(
                (e) => e.status === "pending",
              ).length;

              const ws = (r.workflow_status ?? "draft") as
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

              return (
                <Link
                  key={r.id}
                  href={`/dashboard/supervisor/reports/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#fdfbff] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {r.title ?? `${startDate} – ${endDate}`}
                    </p>
                    <p className="text-[0.65rem] text-[var(--color-text-muted)]">
                      {startDate} – {endDate} · {expCount} gasto
                      {expCount !== 1 ? "s" : ""} · {pendingExpenses} pendiente
                      {pendingExpenses !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${badgeClasses}`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

