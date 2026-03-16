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

  const { data: employeeData, error: ownerError } = await supabase
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
  if (webhookUrl) {
    // Obtener todos los usuarios con rol "pagador"
    const { data: payers, error: payersError } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "pagador");

    if (payersError) {
      console.error(
        "No se pudieron obtener los usuarios con rol pagador para la notificación de rendición aprobada:",
        payersError,
      );
    } else {
      const payerEmailArray =
        (payers ?? [])
          .map((p) => p.email)
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0) ?? [];

      const pagadorEmails = payerEmailArray.join(",");

      const payload = {
        reportId: reportId,
        employeeName: employeeData?.full_name || "Empleado",
        pagadorEmails,
      };

      console.log("Payload Aprobación:", payload);

      try {
        await fetch(webhookUrl as string, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("Error enviando webhook de rendición aprobada a N8N:", error);
      }
    }
  }

  revalidatePath(`/dashboard/reports/${reportId}`);
}

