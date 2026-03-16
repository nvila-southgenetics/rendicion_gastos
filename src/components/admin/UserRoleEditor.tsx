'use client';
import { useState } from "react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Rol "seller" ya no se asigna; se mantiene solo para mostrar usuarios existentes
// "supervisor" se mantiene por compatibilidad (rol antiguo en DB)
type UserRole =
  | "employee"
  | "seller"
  | "aprobador"
  | "supervisor"
  | "pagador"
  | "chusmas"
  | "admin";

const ROLE_LABELS: Record<string, string> = {
  employee:   "Empleado",
  seller:     "Vendedor",
  aprobador:  "Aprobador",
  supervisor: "Aprobador",
  pagador:    "Pagador",
  chusmas:    "Chusmas (solo lectura)",
  admin:      "Administrador",
};

const ROLE_COLORS: Record<string, string> = {
  employee:   "bg-blue-100 text-blue-700",
  seller:     "bg-amber-100 text-amber-700",
  aprobador:  "bg-purple-100 text-purple-700",
  supervisor: "bg-purple-100 text-purple-700",
  pagador:    "bg-emerald-100 text-emerald-700",
  chusmas:    "bg-gray-100 text-gray-700",
  admin:      "bg-red-100 text-red-700",
};

const SELECTABLE_ROLES: UserRole[] = [
  "employee",
  "aprobador",
  "pagador",
  "chusmas",
  "admin",
];

interface Props {
  userId:      string;
  currentRole: UserRole;
  currentUserId: string; // the logged-in admin, to prevent self-demotion
}

export function UserRoleEditor({ userId, currentRole, currentUserId }: Props) {
  const supabase  = createSupabaseBrowserClient();
  const [role, setRole]       = useState<UserRole>(currentRole);
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState(false);

  const isSelf = userId === currentUserId;

  if (!editing) {
    return (
      <button
        onClick={() => { if (!isSelf) setEditing(true); }}
        title={isSelf ? "No podés cambiar tu propio rol" : "Cambiar rol"}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${ROLE_COLORS[role]} ${
          isSelf ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:opacity-80 transition-opacity"
        }`}
      >
        {ROLE_LABELS[role]}
        {!isSelf && <span className="opacity-60">▾</span>}
      </button>
    );
  }

  async function handleChange(newRole: UserRole) {
    if (newRole === role) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(`Error al cambiar rol: ${error.message}`);
    } else {
      setRole(newRole);
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`);
    }
    setEditing(false);
  }

  return (
    <div className="relative inline-block">
      <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-xl border border-[#e5e2ea] bg-white shadow-lg py-1">
        {SELECTABLE_ROLES.map((r) => (
          <button
            key={r}
            disabled={saving}
            onClick={() => handleChange(r)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#f5f1f8] ${
              r === role ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"
            }`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${ROLE_COLORS[r].split(" ")[0]}`} />
            {ROLE_LABELS[r]}
            {r === role && " ✓"}
          </button>
        ))}
        <button
          onClick={() => setEditing(false)}
          className="mt-1 flex w-full items-center px-3 py-1.5 text-left text-[0.65rem] text-[var(--color-text-muted)] hover:bg-[#f5f1f8] border-t border-[#f0ecf4]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
