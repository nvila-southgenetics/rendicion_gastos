import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackButton } from "@/components/ui/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import { SupervisionAssigner } from "@/components/admin/SupervisionAssigner";
import { ViewerAssigner } from "@/components/admin/ViewerAssigner";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";
import { CountryFilter } from "@/components/admin/CountryFilter";

// Incluye "seller" solo para mostrar usuarios existentes con ese rol (rol retirado)
const ROLE_LABELS: Record<string, string> = {
  employee:   "Empleado",
  seller:     "Vendedor",
  supervisor: "Aprobador", // nombre antiguo de rol en DB
  chusmas:    "Chusmas (solo lectura)",
  admin:      "Administrador",
};

const ROLE_COLORS: Record<string, string> = {
  employee:   "bg-blue-100 text-blue-700",
  seller:     "bg-amber-100 text-amber-700",
  supervisor: "bg-purple-100 text-purple-700",
  chusmas:    "bg-gray-100 text-gray-700",
  admin:      "bg-red-100 text-red-700",
};

export default async function AdminUsersPage({
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

  const me = await getMyProfile(supabase, session);
  if (me?.role !== "admin") redirect("/dashboard");

  // Fetch all users (incl. country)
  const { data: rawUsers, error: rawUsersError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, is_active, created_at, country")
    .order("full_name", { ascending: true });

  if (rawUsersError) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="page-title">Gestión de usuarios</h1>
          <p className="page-subtitle">Administrá roles y asignaciones de aprobación.</p>
        </div>
        <div className="card p-6 space-y-2">
          <p className="text-sm font-semibold text-red-700">Error cargando usuarios</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Esto suele ser un problema de permisos/RLS en Supabase para la tabla <code>profiles</code>.
          </p>
          <pre className="whitespace-pre-wrap rounded-lg bg-[#faf7fd] p-3 text-xs text-[var(--color-text-primary)]">
            {rawUsersError.message}
          </pre>
        </div>
      </div>
    );
  }

  const users = (rawUsers ?? []).filter((u) => {
    if (!countryFilter?.length) return true;
    const c = (u as { country?: string }).country ?? "";
    return c && countryFilter.includes(c);
  });

  // Fetch all supervision assignments (with employee info)
  const { data: allAssignments } = await supabase
    .from("supervision_assignments")
    .select("id, supervisor_id, employee_id, profiles!supervision_assignments_employee_id_fkey(id, full_name, email, role)");

  // Fetch all viewer assignments (with employee info)
  const { data: allViewerAssignments } = await supabase
    .from("viewer_assignments")
    .select("id, viewer_id, employee_id, profiles!viewer_assignments_employee_id_fkey(id, full_name, email, role)");

  const userList = users;

  // Group assignments by supervisor
  const assignmentsBySupervisor: Record<string, Array<{
    id: string; employee_id: string;
    employee: { id: string; full_name: string; email: string; role: string };
  }>> = {};

  for (const a of allAssignments ?? []) {
    const emp = a.profiles as { id: string; full_name: string; email: string; role: string } | null;
    if (!emp) continue;
    if (!assignmentsBySupervisor[a.supervisor_id]) assignmentsBySupervisor[a.supervisor_id] = [];
    assignmentsBySupervisor[a.supervisor_id].push({ id: a.id, employee_id: a.employee_id, employee: emp });
  }

  // Also find which supervisors supervise each user (for the employee's row)
  const supervisorsByEmployee: Record<string, string[]> = {};
  for (const a of allAssignments ?? []) {
    if (!supervisorsByEmployee[a.employee_id]) supervisorsByEmployee[a.employee_id] = [];
    const sup = userList.find((u) => u.id === a.supervisor_id);
    if (sup) supervisorsByEmployee[a.employee_id].push(sup.full_name);
  }

  // Group assignments by viewer (chusmas)
  const assignmentsByViewer: Record<string, Array<{
    id: string;
    employee_id: string;
    employee: { id: string; full_name: string; email: string; role: string };
  }>> = {};

  for (const a of allViewerAssignments ?? []) {
    const emp = a.profiles as { id: string; full_name: string; email: string; role: string } | null;
    if (!emp) continue;
    if (!assignmentsByViewer[a.viewer_id]) assignmentsByViewer[a.viewer_id] = [];
    assignmentsByViewer[a.viewer_id].push({ id: a.id, employee_id: a.employee_id, employee: emp });
  }

  // Available users for supervision assignment.
  // Admins can also be supervised for expense-report approval workflow.
  const availableForSupervision = userList
    .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role }));

  const supervisors = userList.filter((u) => u.role === "aprobador" || u.role === "supervisor");
  const viewers     = (rawUsers ?? []).filter((u) => u.role === "chusmas");

  // Para chusmas: empleados asignables = todos los usuarios (sin filtrar por país) menos el propio chusmas
  const allUsersForViewerAssign = (rawUsers ?? []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
  }));

  return (
    <div className="w-full max-w-full space-y-5">
      <div className="space-y-3">
        <BackButton href="/admin" />
        <div className="min-w-0">
          <h1 className="page-title">Gestión de usuarios</h1>
          <p className="page-subtitle">Administrá roles y asignaciones de aprobación.</p>
        </div>
      </div>

      <Suspense fallback={null}>
        <CountryFilter basePath="/dashboard/admin/users" />
      </Suspense>

      {/* Tabla de usuarios */}
      <div className="card w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f0ecf4] px-4 py-3 max-[430px]:px-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Usuarios ({userList.length})
          </h2>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f5f1f8] text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">País</th>
                <th className="px-4 py-3 font-medium">Departamento</th>
                <th className="px-4 py-3 font-medium">Supervisado por</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((user) => {
                const supervisorNames = supervisorsByEmployee[user.id] ?? [];
                return (
                  <tr key={user.id} className="border-t border-[#f0ecf4] hover:bg-[#fdfbff] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-[var(--color-primary)]">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">{user.full_name}</p>
                          <p className="text-[0.65rem] text-[var(--color-text-muted)]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <UserRoleEditor
                          userId={user.id}
                          currentRole={user.role as any}
                          currentUserId={session.user.id}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] hidden lg:table-cell">
                      {(user as { country?: string }).country ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {user.department ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {supervisorNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {supervisorNames.map((name) => (
                            <span key={name} className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[0.65rem] text-purple-700">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                        user.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {user.is_active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <DeleteUserButton
                        userId={user.id}
                        fullName={user.full_name}
                        isCurrentUser={user.id === session.user.id}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-[#f0ecf4] md:hidden">
          {userList.map((user) => {
            const supervisorNames = supervisorsByEmployee[user.id] ?? [];
            return (
              <div key={user.id} className="w-full space-y-2 px-4 py-3 max-[430px]:px-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-[var(--color-primary)]">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{user.full_name}</p>
                    <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <UserRoleEditor
                    userId={user.id}
                    currentRole={user.role as any}
                    currentUserId={session.user.id}
                  />
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${
                    user.is_active !== false ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {user.is_active !== false ? "Activo" : "Inactivo"}
                  </span>
                </div>
                {(user as { country?: string }).country && (
                  <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">
                    País: {(user as { country?: string }).country}
                  </p>
                )}
                {supervisorNames.length > 0 && (
                  <p className="break-words text-[0.65rem] text-[var(--color-text-muted)]">
                    Supervisado por: {supervisorNames.join(", ")}
                  </p>
                )}
                <div className="pt-1">
                  <DeleteUserButton
                    userId={user.id}
                    fullName={user.full_name}
                    isCurrentUser={user.id === session.user.id}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sección de supervisores */}
      {supervisors.length > 0 && (
        <div className="w-full space-y-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Asignaciones de aprobación</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Definí qué empleados aprueba cada aprobador.
            </p>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            {supervisors.map((sup) => {
              const myAssignments = assignmentsBySupervisor[sup.id] ?? [];
              const others = availableForSupervision.filter((u) => u.id !== sup.id);
              return (
                <div key={sup.id} className="card w-full space-y-3 border-l-4 border-purple-300 p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700 sm:h-9 sm:w-9">
                      {sup.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{sup.full_name}</p>
                      <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">{sup.email}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)] mb-2">
                      Aprueba rendiciones de:
                    </p>
                    <SupervisionAssigner
                      supervisorId={sup.id}
                      supervisorName={sup.full_name}
                      initialAssignments={myAssignments}
                      availableEmployees={others}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sección de chusmas (solo lectura) */}
      {viewers.length > 0 && (
        <div className="w-full space-y-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Asignaciones de chusmas</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Usuarios con rol <strong>Chusmas</strong> pueden ver las rendiciones de los empleados asignados, sin poder editarlas.
            </p>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            {viewers.map((viewer) => {
              const myAssignments = assignmentsByViewer[viewer.id] ?? [];
              const available = allUsersForViewerAssign.filter((u) => u.id !== viewer.id);
              return (
                <div key={viewer.id} className="card w-full space-y-3 border-l-4 border-gray-300 p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700 sm:h-9 sm:w-9">
                      {viewer.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{viewer.full_name}</p>
                      <p className="truncate text-[0.65rem] text-[var(--color-text-muted)]">{viewer.email}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)] mb-2">
                      Puede ver rendiciones de:
                    </p>
                    <ViewerAssigner
                      viewerId={viewer.id}
                      viewerName={viewer.full_name}
                      initialAssignments={myAssignments}
                      availableEmployees={available}
                      assignedByUserId={session.user.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {supervisors.length === 0 && (
        <div className="card w-full space-y-2 p-4 text-center sm:p-6">
          <p className="text-sm text-[var(--color-text-muted)]">
            No hay supervisores aún. Cambiá el rol de un usuario a <strong>Supervisor</strong> para asignarle empleados.
          </p>
        </div>
      )}
    </div>
  );
}
