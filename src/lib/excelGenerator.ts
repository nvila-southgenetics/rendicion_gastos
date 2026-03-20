import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateReportWorkbook } from "@/lib/excel/generateReport";

function safeTitleFromReport(report: {
  title: string | null;
  week_start: string;
  week_end: string;
}) {
  const title = report.title ?? null;
  return title
    ? title
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 40)
    : `${report.week_start}_${report.week_end}`;
}

export async function generateExcelExport(reportId: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: report, error: reportError } = await supabase
    .from("weekly_reports")
    .select("*, profiles!weekly_reports_user_id_fkey(full_name)")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError || !report) {
    throw new Error("Rendición no encontrada");
  }

  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select(
      "expense_date, category, description, amount, currency, status, ticket_url, rejection_reason",
    )
    .eq("report_id", reportId)
    .order("expense_date", { ascending: true });

  if (expensesError) {
    throw new Error("No se pudieron obtener los gastos");
  }

  const { data: presets } = await supabase
    .from("exchange_rate_presets")
    .select("currency, rate");

  const globalPresets: Record<string, number> = {};
  for (const p of presets ?? []) globalPresets[p.currency] = Number(p.rate);

  const reportRates = (report.exchange_rates ?? {}) as Record<string, number>;
  const exchangeRates: Record<string, number> = { ...globalPresets, ...reportRates };

  const employeeName = (report as any).profiles?.full_name ?? "";
  const title = report.title ?? null;
  const safeTitle = safeTitleFromReport({
    title,
    week_start: report.week_start,
    week_end: report.week_end,
  });

  const workbookBuffer = generateReportWorkbook({
    employeeName,
    title,
    weekStart: report.week_start,
    weekEnd: report.week_end,
    closedAt: report.closed_at,
    exchangeRates,
    budgetCurrency: report.budget_currency ?? "USD",
    expenses: (expenses ?? []) as any,
  });

  const buffer = Buffer.isBuffer(workbookBuffer)
    ? workbookBuffer
    : Buffer.from(workbookBuffer as any);

  return { buffer, fileName: `rendicion_${safeTitle}.xlsx` };
}

export async function generateExcelBuffer(reportId: string): Promise<Buffer> {
  const { buffer } = await generateExcelExport(reportId);
  return buffer;
}

