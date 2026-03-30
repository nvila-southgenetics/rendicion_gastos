import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { ChusmaFilters } from "@/components/chusma/ChusmaFilters";

type SearchParams = Record<string, string | string[] | undefined>;

function pickParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export default async function ChusmaViewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const sp = await searchParams;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);

  const isChusma = me?.role === "chusmas" || me?.role === "chusma";
  const isAdmin = me?.role === "admin";
  if (!isChusma && !isAdmin) redirect("/dashboard");

  // Regla de negocio: chusmas ven TODAS las rendiciones que ya pasaron revisión (approved/paid).
  // Admin también puede ver todas.
  const status = pickParam(sp, "status")?.trim();
  const country = pickParam(sp, "country")?.trim();
  const employee = pickParam(sp, "employee")?.trim();
  const approver = pickParam(sp, "approver")?.trim();
  const from = pickParam(sp, "from")?.trim(); // YYYY-MM-DD
  const to = pickParam(sp, "to")?.trim(); // YYYY-MM-DD

  const needsEmployeeJoin = Boolean(country) || Boolean(employee);
  const needsApproverJoin = Boolean(approver);

  const select = `
      id,
      title,
      created_at,
      closed_at,
      total_amount,
      workflow_status,
      user_id,
      employee:profiles!weekly_reports_user_id_fkey${needsEmployeeJoin ? "!inner" : ""}(full_name, country),
      approver:profiles!weekly_reports_closed_by_fkey${needsApproverJoin ? "!inner" : ""}(full_name)
      `;

  let reportsQuery = supabase
    .from("weekly_reports")
    .select(select);

  if (status === "approved" || status === "paid") {
    reportsQuery = reportsQuery.eq("workflow_status", status);
  } else {
    reportsQuery = reportsQuery.in("workflow_status", ["approved", "paid"]);
  }

  if (country) {
    reportsQuery = reportsQuery.ilike("employee.country", `%${country}%`);
  }
  if (employee) {
    reportsQuery = reportsQuery.ilike("employee.full_name", `%${employee}%`);
  }
  if (approver) {
    reportsQuery = reportsQuery.ilike("approver.full_name", `%${approver}%`);
  }
  const isISODate = (s?: string) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (isISODate(from)) {
    const start = new Date(from + "T00:00:00.000Z").toISOString();
    reportsQuery = reportsQuery.gte("created_at", start);
  }
  if (isISODate(to)) {
    const end = new Date(to + "T23:59:59.999Z").toISOString();
    reportsQuery = reportsQuery.lte("created_at", end);
  }

  reportsQuery = reportsQuery.order("created_at", { ascending: false });

  const { data: reports } = await reportsQuery;

  const reportList = (reports ?? []) as unknown as Array<{
    id: string;
    title: string | null;
    created_at: string | null;
    closed_at: string | null;
    total_amount: number | null;
    workflow_status: string | null;
    user_id: string;
    employee: { full_name: string; country: string | null } | null;
    approver: { full_name: string } | null;
  }>;

  return (
    <div className="w-full max-w-full space-y-5">
      <div className="min-w-0">
        <h1 className="page-title">Auditoría</h1>
        <p className="page-subtitle">
          Rendiciones aprobadas o pagadas (solo lectura).
        </p>
      </div>

      <ChusmaFilters
        searchParams={{
          status,
          country,
          employee,
          approver,
          from,
          to,
        }}
      />

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {reportList.length === 0 && (
          <div className="card px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            No hay rendiciones para auditar.
          </div>
        )}
        {reportList.map((r) => {
          const ws = (r.workflow_status ?? "approved") as "approved" | "paid";
          const dateStr = (r.closed_at ?? r.created_at)
            ? new Date((r.closed_at ?? r.created_at) as string).toLocaleDateString("es-UY")
            : "—";

          return (
            <Link
              key={r.id}
              href={`/dashboard/viewer/reports/${r.id}`}
              className="card block w-full space-y-2 p-3 transition-colors hover:bg-[#fdfbff]"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {r.title ?? "Sin título"}
                  </p>
                  <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">
                    {r.employee?.full_name ?? "—"} · {dateStr}
                  </p>
                </div>
                {ws === "paid" ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] font-semibold text-emerald-700">Pagada</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[0.6rem] font-semibold text-gray-700">Pendiente</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
                {r.approver?.full_name && <span>Aprob: {r.approver.full_name}</span>}
                {r.employee?.country && <span>{r.employee.country}</span>}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {typeof r.total_amount === "number"
                    ? r.total_amount.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "—"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Empleado</th>
                <th className="px-4 py-3 font-semibold">Aprobador</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">País</th>
                <th className="px-4 py-3 font-semibold text-right">Monto total</th>
                <th className="px-4 py-3 font-semibold text-center">Pagada</th>
              </tr>
            </thead>
            <tbody>
              {reportList.map((r) => {
                const ws = (r.workflow_status ?? "approved") as "approved" | "paid";
                const dateStr = (r.closed_at ?? r.created_at)
                  ? new Date((r.closed_at ?? r.created_at) as string).toLocaleDateString("es-UY")
                  : "—";

                return (
                  <tr
                    key={r.id}
                    className="border-t border-[#f0ecf4] hover:bg-[#fdfbff] transition-colors"
                  >
                    <td className="px-4 py-3 align-middle">
                      <Link
                        href={`/dashboard/viewer/reports/${r.id}`}
                        className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary)]"
                      >
                        {r.title ?? "Sin título"}
                      </Link>
                      <p className="text-[0.7rem] text-[var(--color-text-muted)]">
                        {r.id}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {r.employee?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {r.approver?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                      {dateStr}
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-muted)]">
                      {r.employee?.country ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-middle text-right font-semibold whitespace-nowrap">
                      {typeof r.total_amount === "number"
                        ? r.total_amount.toLocaleString("es-UY", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      {ws === "paid" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {reportList.length === 0 && (
                <tr className="border-t border-[#f0ecf4]">
                  <td className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]" colSpan={7}>
                    No hay rendiciones aprobadas o pagadas para auditar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

