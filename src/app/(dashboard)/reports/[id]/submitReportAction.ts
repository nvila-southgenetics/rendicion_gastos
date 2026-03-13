import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function submitReportAction(formData: FormData) {
  "use server";

  const reportId = formData.get("reportId") as string | null;
  if (!reportId) {
    throw new Error("reportId requerido");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Asegurar que la rendición pertenece al usuario
  const { data: report, error: reportError } = await supabase
    .from("weekly_reports")
    .select("id, user_id")
    .eq("id", reportId)
    .single();

  if (reportError || !report || report.user_id !== session!.user.id) {
    throw new Error("No se encontró la rendición o no tenés permisos.");
  }

  // Cambiar estado del workflow a submitted
  const { error: updateError } = await supabase
    .from("weekly_reports")
    .update({ workflow_status: "submitted" })
    .eq("id", reportId);

  if (updateError) {
    throw new Error("No se pudo enviar la rendición.");
  }

  // Notificación a n8n de nueva rendición
  const webhookUrl = process.env.N8N_WEBHOOK_URL_NUEVA_RENDICION;
  if (webhookUrl) {
    const [{ data: employee }, { data: assignments }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session!.user.id)
        .single(),
      supabase
        .from("supervision_assignments")
        .select(
          "supervisor_id, profiles!supervision_assignments_supervisor_id_fkey(email)",
        )
        .eq("employee_id", session!.user.id),
    ]);

    const supervisorEmails = (assignments ?? [])
      .map((a) => (a.profiles as { email: string | null } | null)?.email)
      .filter((e): e is string => !!e)
      .join(",");

    const payload = {
      reportId,
      employeeId: session!.user.id,
      employeeName: employee?.full_name ?? "",
      employeeEmail: employee?.email ?? "",
      supervisorEmails,
    };

    console.log("Payload hacia n8n (nueva rendición):", payload);

    try {
      const response = await fetch(webhookUrl as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("Status de n8n (nueva rendición):", response.status);
    } catch (error) {
      console.error("Error enviando webhook de nueva rendición a N8N:", error);
    }
  }

  revalidatePath(`/dashboard/reports/${reportId}`);
}

