import { redirect } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ViewerEmployeeReportsPage({ params }: Props) {
  const { id: employeeId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);

  const isPagador = me?.role === "pagador";

  if (me?.role !== "chusmas" && me?.role !== "admin" && !isPagador) {
    redirect("/dashboard");
  }

  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, role")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) {
    redirect("/dashboard/viewer");
  }

  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("id, title, week_start, week_end, status, workflow_status, expenses(id, status)")
    .eq("user_id", employeeId)
    .order("created_at", { ascending: false });

  const allReports =
    (reports ?? []) as Array<{
      id: string;
      title: string | null;
      week_start: string;
      week_end: string;
      status: "open" | "closed";
      workflow_status: string | null;
      expenses: Array<{ id: string; status: string | null }> | null;
    }>;

  const reportList = isPagador
    ? allReports.filter((r) => {
        const ws = (r.workflow_status ?? "draft") as
          | "draft"
          | "submitted"
          | "needs_correction"
          | "approved"
          | "paid";
        return ws === "approved" || ws === "paid";
      })
    : allReports;

  return (
    <div className="w-full max-w-full space-y-5">
      <div className="space-y-3">
        <BackButton href="/dashboard/viewer" />
        <div className="min-w-0">
          <h1 className="page-title break-words">Rendiciones de {employee.full_name}</h1>
          <p className="page-subtitle">
            Vista solo lectura de las rendiciones de este empleado.
          </p>
        </div>
      </div>

      <div className="card flex w-full items-center gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700 sm:h-10 sm:w-10">
          {employee.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {employee.full_name}
          </p>
          <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">
            {employee.email}
            {employee.department && ` · ${employee.department}`}
          </p>
        </div>
      </div>

      {reportList.length === 0 ? (
        <div className="card space-y-2 p-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Este empleado aún no tiene rendiciones.
          </p>
        </div>
      ) : (
        <div className="card w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#f0ecf4] px-4 py-3 max-[430px]:px-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Rendiciones ({reportList.length})
            </h2>
          </div>
          <div className="divide-y divide-[#f0ecf4]">
            {reportList.map((r) => {
              const startDate = new Date(
                r.week_start + "T12:00:00",
              ).toLocaleDateString("es-UY", {
                day: "numeric",
                month: "short",
              });
              const endDate = new Date(
                r.week_end + "T12:00:00",
              ).toLocaleDateString("es-UY", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const expCount = (r.expenses ?? []).length;

              const ws = (r.workflow_status ?? "draft") as
                | "draft"
                | "submitted"
                | "needs_correction"
                | "approved"
                | "paid";

              const label =
                ws === "submitted"
                  ? "Revisión"
                  : ws === "approved"
                    ? "Aprobada"
                    : ws === "paid"
                      ? "Pagada"
                      : ws === "needs_correction"
                        ? "Devuelta"
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
                  href={`/dashboard/viewer/reports/${r.id}`}
                  className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-[#fdfbff] max-[430px]:px-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {r.title ?? `${startDate} – ${endDate}`}
                    </p>
                    <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">
                      {startDate} – {endDate} · {expCount} gasto{expCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${badgeClasses}`}
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

