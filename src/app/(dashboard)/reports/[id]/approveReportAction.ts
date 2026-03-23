import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateExcelExport } from "@/lib/excelGenerator";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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
        .select("id, user_id, title, total_amount")
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
    .select("full_name, email, country")
    .eq("id", report.user_id)
    .single();

  if (ownerError) {
    throw new Error("No se pudo obtener el dueño de la rendición.");
  }

  const { error: updateError } = await supabase
    .from("weekly_reports")
    .update({
      workflow_status: "approved",
      status: "closed",
      closed_by: session.user.id,
      closed_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (updateError) {
    throw new Error("No se pudo aprobar la rendición.");
  }

  const webhookUrl =
    process.env.N8N_WEBHOOK_URL_APROBAR_CIERRE ??
    process.env.N8N_WEBHOOK_URL_RENDICION_APROBADA;
  if (webhookUrl) {
    // Obtener todos los usuarios con rol "pagador"
    const { data: payers, error: payersError } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "pagador");

    let effectivePayers = payers ?? [];
    // Si por RLS no devolvi? filas, intentar fallback con service role (si est? configurado).
    if (effectivePayers.length === 0) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (serviceRoleKey && supabaseUrl) {
        const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
        const { data: adminPayers, error: adminPayersError } = await adminClient
          .from("profiles")
          .select("email")
          .eq("role", "pagador");
        if (adminPayersError) {
          console.error(
            "Fallback service role: no se pudieron obtener pagadores para aprobaci?n:",
            adminPayersError,
          );
        } else {
          effectivePayers = adminPayers ?? [];
        }
      } else {
        console.warn(
          "No se pudo usar fallback de service role para pagadores: faltan SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL.",
        );
      }
    }

    if (payersError) {
      console.error(
        "No se pudieron obtener los usuarios con rol pagador para la notificación de rendición aprobada:",
        payersError,
      );
    } else {
      const payerEmailArray = Array.from(
        new Set(
          (effectivePayers ?? [])
            .map((p) => p.email)
            .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
            .map((e) => e.trim().toLowerCase()),
        ),
      );

      const pagadorEmails = payerEmailArray.join(",");
      const employeeEmail =
        typeof employeeData?.email === "string" ? employeeData.email : "";

      const targetEmails = Array.from(
        new Set(
          [employeeEmail, ...pagadorEmails.split(",")]
            .map((e) => e.trim())
            .filter(Boolean),
        ),
      ).join(",");

      let excelBase64 = "";
      let excelName = `Rendicion_${reportId.slice(0, 6)}.xlsx`;
      try {
        const { buffer, fileName } = await generateExcelExport(reportId);
        excelBase64 = buffer.toString("base64");
        excelName = fileName;
      } catch (e) {
        console.error("No se pudo generar Excel para webhook (rendición aprobada):", e);
      }

      const closedAtIso = new Date().toISOString();
      const payload = {
        reportId: reportId,
        reportTitle: report?.title ?? "",
        employeeName: employeeData?.full_name || "Empleado",
        country: employeeData?.country ?? "",
        amount: report?.total_amount ?? 0,
        closingDate: closedAtIso.slice(0, 10),
        closedAt: closedAtIso,
        employeeEmail,
        pagadorEmails,
        pagadorEmailList: payerEmailArray,
        // Compatibilidad con flujos n8n antiguos
        targetEmails,
        excelBase64,
        excelName,
      };

      console.log("Payload Aprobación:", payload);

      try {
        const response = await fetch(webhookUrl as string, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          console.error("Error devuelto por n8n (rendición aprobada):", await response.text());
        }
      } catch (error) {
        console.error("Error enviando webhook de rendición aprobada a N8N:", error);
      }
    }
  }

  revalidatePath(`/dashboard/reports/${reportId}`);
}

