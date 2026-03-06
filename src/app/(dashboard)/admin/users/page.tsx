import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import { SupervisionAssigner } from "@/components/admin/SupervisionAssigner";
import { DeleteUserButton } from "@/components/admin/DeleteUserButton";

const ROLE_LABELS: Record<string, string> = {
  employee:   "Empleado",
  seller:     "Vendedor",
  supervisor: "Supervisor",
  admin:      "Administrador",
};

const ROLE_COLORS: Record<string, string> = {
  employee:   "bg-blue-100 text-blue-700",
  seller:     "bg-amber-100 text-amber-700",
  supervisor: "bg-purple-100 text-purple-700",
  admin:      "bg-red-100 text-red-700",
};

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", session.user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Fetch all users
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, is_active, created_at")
    .order("full_name", { ascending: true });

  // Fetch all supervision assignments (with employee info)
  const { data: allAssignments } = await supabase
    .from("supervision_assignments")
    .select("id, supervisor_id, employee_id, profiles!supervision_assignments_employee_id_fkey(id, full_name, email, role)");

  const userList = users ?? [];

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

  // Available users for supervision assignment (non-admin)
  const availableForSupervision = userList
    .filter((u) => u.role !== "admin")
    .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, role: u.role }));

  const supervisors = userList.filter((u) => u.role === "supervisor");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Gestión de usuarios</h1>
        <p className="page-subtitle">Administrá roles y asignaciones de supervisión.</p>
      </div>

      {/* Tabla de usuarios */}
      <div className="card overflow-hidden">
        <div className="border-b border-[#f0ecf4] px-4 py-3 flex items-center justify-between">
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
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
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
        <div className="md:hidden divide-y divide-[#f0ecf4]">
          {userList.map((user) => {
            const supervisorNames = supervisorsByEmployee[user.id] ?? [];
            return (
              <div key={user.id} className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{user.full_name}</p>
                    <p className="text-[0.65rem] text-[var(--color-text-muted)] truncate">{user.email}</p>
                  </div>
                  <div className="relative">
                    <UserRoleEditor
                      userId={user.id}
                      currentRole={user.role as any}
                      currentUserId={session.user.id}
                    />
                  </div>
                </div>
                {supervisorNames.length > 0 && (
                  <p className="text-[0.65rem] text-[var(--color-text-muted)]">
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
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Asignaciones de supervisión</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Definí qué empleados supervisa cada supervisor.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {supervisors.map((sup) => {
              const myAssignments = assignmentsBySupervisor[sup.id] ?? [];
              const others = availableForSupervision.filter((u) => u.id !== sup.id);
              return (
                <div key={sup.id} className="card p-4 space-y-3 border-l-4 border-purple-300">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                      {sup.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--color-text-primary)]">{sup.full_name}</p>
                      <p className="text-[0.65rem] text-[var(--color-text-muted)]">{sup.email}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase text-[var(--color-text-muted)] mb-2">
                      Supervisa a:
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

      {supervisors.length === 0 && (
        <div className="card p-6 text-center space-y-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            No hay supervisores aún. Cambiá el rol de un usuario a <strong>Supervisor</strong> para asignarle empleados.
          </p>
        </div>
      )}
    </div>
  );
}
