import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { BackButton } from "@/components/ui/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { CountryFilter } from "@/components/admin/CountryFilter";

const WORKFLOW_BADGE: Record<string, { label: string; classes: string }> = {
  paid:             { label: "Pagada",              classes: "bg-blue-100 text-blue-700" },
  approved:         { label: "Aprobada",            classes: "bg-emerald-100 text-emerald-700" },
  submitted:        { label: "En revisión",         classes: "bg-amber-100 text-amber-700" },
  needs_correction: { label: "Con correcciones",    classes: "bg-red-100 text-red-700" },
  draft:            { label: "Borrador",            classes: "bg-gray-100 text-gray-500" },
};

function getStatusBadge(status: string, workflowStatus: string) {
  if (status === "open" && workflowStatus === "draft") {
    return { label: "Abierta", classes: "bg-emerald-100 text-emerald-700" };
  }
  return WORKFLOW_BADGE[workflowStatus] ?? { label: workflowStatus, classes: "bg-gray-100 text-gray-500" };
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const countryFilter = params.country
    ? params.country.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Verificar que sea admin
  const me = await getMyProfile(supabase, session);
  if (me?.role !== "admin") redirect("/dashboard");

  // Traer todas las rendiciones con datos del usuario (incl. país) y conteo de gastos
  const { data: rawReports } = await supabase
    .from("weekly_reports")
    .select(`
      *,
      profiles!weekly_reports_user_id_fkey(full_name, email, country),
      expenses(count)
    `)
    .order("created_at", { ascending: false });

  const reports = (rawReports ?? []).filter((r) => {
    if (!countryFilter?.length) return true;
    const user = r.profiles as { full_name?: string; email?: string; country?: string } | null;
    const country = user?.country ?? "";
    return country && countryFilter.includes(country);
  });

  const pendingCount = reports.filter((r) => r.status === "open").length;

  return (
    <div className="w-full max-w-full space-y-5">
      <div className="space-y-4">
        <BackButton href="/admin" />
        <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-[var(--color-primary)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 18v-4"/><path d="M14 18v-2"/></svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-[var(--color-text-primary)] sm:text-lg">Rendiciones</h1>
                <p className="text-xs text-[var(--color-text-muted)]">Panel de administración</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 sm:gap-4">
            <div className="rounded-xl bg-[#f5f1f8] px-3 py-2 text-center">
              <p className="text-lg font-bold text-[var(--color-primary)] sm:text-xl">{reports.length}</p>
              <p className="text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">Total</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-emerald-600 sm:text-xl">{pendingCount}</p>
              <p className="text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">Abiertas</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-gray-600 sm:text-xl">{reports.length - pendingCount}</p>
              <p className="text-[0.6rem] font-semibold uppercase text-[var(--color-text-muted)]">Cerradas</p>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <CountryFilter basePath="/dashboard/admin/reports" />
      </Suspense>

      <div className="card w-full overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f1f8] text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Empleado</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">País</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Gastos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {reports && reports.length > 0 ? (
                reports.map((r) => {
                  const user = r.profiles as { full_name: string; email: string; country?: string } | null;
                  const expenseCount = (r.expenses as { count: number }[])?.[0]?.count ?? 0;
                  const badge = getStatusBadge(r.status ?? "open", r.workflow_status ?? "draft");
                  return (
                    <tr key={r.id} className="border-t border-[#f0ecf4] transition-colors hover:bg-[#faf7fd]">
                      <td className="px-4 py-3 align-middle">
                        <Link href={`/dashboard/admin/reports/${r.id}`} className="block">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {user?.full_name ?? "—"}
                          </p>
                          <p className="text-[0.7rem] text-[var(--color-text-muted)]">{user?.email}</p>
                          {r.title && (
                            <p className="max-w-[180px] truncate text-[0.7rem] font-medium text-[var(--color-primary)]">
                              {r.title}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3 align-middle text-xs text-[var(--color-text-muted)] lg:table-cell">
                        {user?.country ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-[var(--color-text-muted)]">
                        {new Date(r.week_start + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(r.week_end + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-middle text-right text-sm font-semibold">
                        {Number(r.total_amount ?? 0).toLocaleString("es-UY", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs font-normal text-[var(--color-text-muted)]">USD</span>
                      </td>
                      <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-muted)]">
                        {expenseCount} {expenseCount === 1 ? "gasto" : "gastos"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                    No hay rendiciones aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-[#f0ecf4] md:hidden">
          {reports && reports.length > 0 ? (
            reports.map((r) => {
              const user = r.profiles as { full_name: string; email: string; country?: string } | null;
              const expenseCount = (r.expenses as { count: number }[])?.[0]?.count ?? 0;
              const badge = getStatusBadge(r.status ?? "open", r.workflow_status ?? "draft");
              return (
                <Link
                  key={r.id}
                  href={`/dashboard/admin/reports/${r.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3 transition-colors active:bg-[#f5f1f8] max-[430px]:px-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-[var(--color-primary)]">
                    {(user?.full_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {user?.full_name ?? "—"}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                    {r.title && (
                      <p className="truncate text-[0.7rem] font-medium text-[var(--color-primary)]">
                        {r.title}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.65rem] text-[var(--color-text-muted)]">
                      <span>
                        {new Date(r.week_start + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(r.week_end + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" })}
                      </span>
                      <span>{expenseCount} {expenseCount === 1 ? "gasto" : "gastos"}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {Number(r.total_amount ?? 0).toLocaleString("es-UY", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)]">USD</p>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
              No hay rendiciones aún.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
