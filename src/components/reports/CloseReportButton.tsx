'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendReportClosedNotification } from "@/lib/n8n/sendReportClosedNotification";

interface ReportStatusButtonProps {
  reportId: string;
  currentStatus: "open" | "closed";
}

export function CloseReportButton({ reportId, currentStatus }: ReportStatusButtonProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);

  const isOpen = currentStatus === "open";

  async function handleToggle() {
    setLoading(true);

    // Obtener usuario actual y su perfil
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      setConfirming(false);
      toast.error("No hay sesión activa.");
      return;
    }

    const userId = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", userId)
      .single();

    const shouldNotifyAsSubmitter =
      profile?.role === "employee" || profile?.role === "admin";

    const updates = isOpen
      ? { status: "closed" as const, closed_at: new Date().toISOString() }
      : { status: "open"   as const, closed_at: null };

    const { error } = await supabase
      .from("weekly_reports")
      .update(updates)
      .eq("id", reportId);

    setLoading(false);
    setConfirming(false);

    if (error) {
      toast.error(`Error: ${error.message ?? "No se pudo actualizar la rendición."}`);
      return;
    }

    // Si quien cierra actúa como rendidor (empleado o admin), avisar a N8N (incluyendo Excel)
    if (isOpen && shouldNotifyAsSubmitter && profile) {
      try {
        const [{ data: supervisorRows }, excelRes] = await Promise.all([
          supabase
            .from("supervision_assignments")
            .select("supervisor_id, profiles!supervision_assignments_supervisor_id_fkey(id, full_name, email)")
            .eq("employee_id", userId),
          fetch(`/api/reports/export?report_id=${reportId}`),
        ]);

        const supervisors =
          supervisorRows
            ?.map((row) => row.profiles as { id: string; full_name: string; email: string } | null)
            .filter((s): s is { id: string; full_name: string; email: string } => !!s) ?? [];

        let excelPayload: { filename: string; contentType: string; base64: string } | null = null;

        if (excelRes.ok) {
          const arrayBuffer = await excelRes.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = typeof btoa !== "undefined"
            ? btoa(binary)
            : Buffer.from(arrayBuffer).toString("base64");

          const dispo = excelRes.headers.get("Content-Disposition") || "";
          const match = dispo.match(/filename=\"?([^\";]+)\"?/i);
          const filename = match?.[1] ?? `rendicion_${reportId}.xlsx`;
          const contentType =
            excelRes.headers.get("Content-Type") ??
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

          excelPayload = {
            filename,
            contentType,
            base64,
          };
        } else {
          console.error("No se pudo obtener el Excel para la notificación:", await excelRes.text());
        }

        // No bloquea la UI; errores solo se loguean en consola dentro de la función
        void sendReportClosedNotification({
          reportId,
          employee: {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
          },
          supervisors,
          excel: excelPayload,
        });
      } catch (err) {
        console.error("Error preparando webhook de cierre:", err);
      }
    }

    toast.success(isOpen ? "Rendición cerrada." : "Rendición reabierta.");
    router.refresh();
  }

  return null;
}
