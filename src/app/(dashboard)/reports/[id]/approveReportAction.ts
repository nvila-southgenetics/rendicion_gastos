import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function approveReportAction(formData: FormData) {
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

  const [{ data: report, error: reportError }, { data: expenses, error: expensesError }] =
    await Promise.all([
      supabase
        .from("weekly_reports")
        .select("id, user_id")
        .eq("id", reportId)
        .single(),
      supabase
        .from("expenses")
        .select("id, status")
        .eq("report_id", reportId),
    ]);

  if (reportError || !report) {
    throw new Error("No se encontró la rendición.");
  }

  if (expensesError) {
    throw new Error("No se pudieron obtener los gastos de la rendición.");
  }

  const expenseList = expenses ?? [];
  const hasAnyNotApproved = expenseList.some(
    (e) => e.status !== "approved",
  );

  if (expenseList.length === 0 || hasAnyNotApproved) {
    throw new Error(
      "No se puede aprobar la rendición si hay gastos pendientes o rechazados.",
    );
  }

  const { data: owner, error: ownerError } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", report.user_id)
    .single();

  if (ownerError) {
    throw new Error("No se pudo obtener el dueño de la rendición.");
  }

  const { error: updateError } = await supabase
    .from("weekly_reports")
    .update({ workflow_status: "approved", status: "closed" })
    .eq("id", reportId);

  if (updateError) {
    throw new Error("No se pudo aprobar la rendición.");
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL_RENDICION_APROBADA;
  if (webhookUrl && owner?.email) {
    const adminEmail = "vvasconcellos@southgenetics.com";
    const payload = {
      reportId,
      employeeId: report.user_id,
      employeeName: owner.full_name ?? "",
      employeeEmail: owner.email,
      adminEmail,
    };

    console.log("Payload hacia n8n (rendición aprobada):", payload);

    try {
      const response = await fetch(webhookUrl as string, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("Status de n8n (rendición aprobada):", response.status);
    } catch (error) {
      console.error("Error enviando webhook de rendición aprobada a N8N:", error);
    }
  }

  revalidatePath(`/dashboard/reports/${reportId}`);
}

