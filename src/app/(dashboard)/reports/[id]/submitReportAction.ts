import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateExcelExport } from "@/lib/excelGenerator";

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
    .select("id, user_id, workflow_status")
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

  const previousWorkflowStatus = (report.workflow_status ?? "draft") as
    | "draft"
    | "submitted"
    | "needs_correction"
    | "approved"
    | "paid";
  const isResubmission = previousWorkflowStatus === "needs_correction";

  // Webhook de cierre inicial vs reenvío corregido
  const webhookUrl = isResubmission
    ? process.env.N8N_WEBHOOK_URL_RENDICION_CORREGIDA
    : process.env.N8N_WEBHOOK_URL_NUEVA_RENDICION;
  if (webhookUrl) {
    const [{ data: employee }, { data: assignments }, { data: reportExpenses }] = await Promise.all([
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
      supabase
        .from("expenses")
        .select("merchant_name")
        .eq("report_id", reportId),
    ]);

    const supervisorEmails = (assignments ?? [])
      .map((a) => (a.profiles as { email: string | null } | null)?.email)
      .filter((e): e is string => !!e)
      .join(",");

    const merchantList = Array.from(
      new Set(
        (reportExpenses ?? [])
          .map((expense) => expense.merchant_name?.trim() ?? "")
          .filter((merchant) => merchant.length > 0),
      ),
    );
    const primaryMerchant = merchantList[0] ?? "";

    let excelBase64 = "";
    let excelName = `Rendicion_${reportId.slice(0, 6)}.xlsx`;
    try {
      const { buffer, fileName } = await generateExcelExport(reportId);
      excelBase64 = buffer.toString("base64");
      excelName = fileName;
    } catch (e) {
      console.error("No se pudo generar Excel para webhook (nueva rendición):", e);
    }

    const payload = {
      reportId,
      employeeId: session!.user.id,
      employeeName: employee?.full_name ?? "",
      employeeEmail: employee?.email ?? "",
      supervisorEmails,
      comercio: primaryMerchant,
      empresa: primaryMerchant,
      merchant: primaryMerchant,
      merchantList,
      previousWorkflowStatus,
      isResubmission,
      // Compatibilidad con flujos n8n antiguos
      targetEmails: supervisorEmails,
      excelBase64,
      excelName,
    };

    console.log(
      `Payload hacia n8n (${isResubmission ? "rendición corregida" : "nueva rendición"}):`,
      payload,
    );

    try {
      const response = await fetch(webhookUrl as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log(
        `Status de n8n (${isResubmission ? "rendición corregida" : "nueva rendición"}):`,
        response.status,
      );
      if (!response.ok) {
        console.error(
          `Error devuelto por n8n (${isResubmission ? "rendición corregida" : "nueva rendición"}):`,
          await response.text(),
        );
      }
    } catch (error) {
      console.error(
        `Error enviando webhook de ${isResubmission ? "rendición corregida" : "nueva rendición"} a N8N:`,
        error,
      );
    }
  }

  revalidatePath(`/dashboard/reports/${reportId}`);
}

