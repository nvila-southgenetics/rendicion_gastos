'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { X, Plus } from "lucide-react";

interface UserOption {
  id:        string;
  full_name: string;
  email:     string;
  role:      string;
}

interface Assignment {
  id:          string;
  employee_id: string;
  employee:    UserOption;
}

interface Props {
  supervisorId:        string;
  supervisorName:      string;
  initialAssignments:  Assignment[];
  /** All users that can be assigned (except the supervisor themselves) */
  availableEmployees:  UserOption[];
}

const ROLE_LABELS: Record<string, string> = {
  employee: "Empleado",
  seller: "Vendedor",
  aprobador: "Aprobador",
  admin: "Administrador",
  chusmas: "Chusma",
  pagador: "Pagador",
};

export function SupervisionAssigner({
  supervisorId,
  supervisorName,
  initialAssignments,
  availableEmployees,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [adding, setAdding]           = useState(false);
  const [saving, setSaving]           = useState(false);

  const assignedIds = new Set(assignments.map((a) => a.employee_id));
  const unassigned  = availableEmployees.filter((u) => !assignedIds.has(u.id));

  async function addEmployee(emp: UserOption) {
    setSaving(true);
    const { data, error } = await supabase
      .from("supervision_assignments")
      .insert({ supervisor_id: supervisorId, employee_id: emp.id })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(`Error al asignar: ${error.message}`);
      return;
    }
    setAssignments((prev) => [...prev, { id: data.id, employee_id: emp.id, employee: emp }]);
    toast.success(`${emp.full_name} asignado a ${supervisorName} (aprobador)`);
    router.refresh();
    setAdding(false);
  }

  async function removeEmployee(assignmentId: string, empName: string) {
    setSaving(true);
    const { error } = await supabase
      .from("supervision_assignments")
      .delete()
      .eq("id", assignmentId);
    setSaving(false);
    if (error) {
      toast.error(`Error al quitar: ${error.message}`);
      return;
    }
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    toast.success(`${empName} quitado de la supervisión`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {assignments.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] italic">Sin empleados asignados.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 pl-2.5 pr-1.5 py-1 text-xs text-purple-800"
            >
              <span className="font-medium">{a.employee.full_name}</span>
              <span className="text-purple-400 text-[0.65rem]">
                ({ROLE_LABELS[a.employee.role] ?? a.employee.role})
              </span>
              <button
                onClick={() => removeEmployee(a.id, a.employee.full_name)}
                disabled={saving}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-200 text-purple-700 hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="rounded-xl border border-[#e5e2ea] bg-[#faf7fd] p-3 space-y-2">
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">Seleccionar empleado a supervisar:</p>
          {unassigned.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] italic">No hay más usuarios disponibles.</p>
          ) : (
            <div className="grid gap-1 max-h-48 overflow-y-auto">
              {unassigned.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addEmployee(u)}
                  disabled={saving}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white border border-transparent hover:border-[#e5e2ea] transition-colors"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)] truncate">{u.full_name}</p>
                    <p className="text-[0.65rem] text-[var(--color-text-muted)] truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setAdding(false)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
          >
            Cancelar
          </button>
        </div>
      ) : (
        unassigned.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-purple-300 bg-transparent px-3 py-1 text-xs text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Agregar empleado
          </button>
        )
      )}
    </div>
  );
}
