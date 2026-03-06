'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface DeleteUserButtonProps {
  userId: string;
  fullName: string;
  isCurrentUser: boolean;
}

export function DeleteUserButton({ userId, fullName, isCurrentUser }: DeleteUserButtonProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);

  if (isCurrentUser) {
    return null;
  }

  async function handleDelete() {
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    setLoading(false);
    setConfirming(false);

    if (error) {
      toast.error(`No se pudo eliminar al usuario: ${error.message}`);
      return;
    }

    toast.success("Usuario eliminado.");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[0.65rem] text-[var(--color-text-muted)]">¿Eliminar?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-full bg-red-600 px-2.5 py-0.5 text-[0.65rem] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Borrando..." : "Sí"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-full border border-[#e5e2ea] px-2.5 py-0.5 text-[0.65rem] text-[var(--color-text-primary)] hover:bg-[#f5f1f8]"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-full border border-red-200 px-2.5 py-0.5 text-[0.65rem] font-medium text-red-600 hover:bg-red-50"
    >
      Eliminar
    </button>
  );
}

