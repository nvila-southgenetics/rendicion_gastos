import * as XLSX from "xlsx";

interface ExpenseRow {
  expense_date: string;
  category: string;
  description: string;
  merchant_name?: string | null;
  amount: number;
  currency: string | null;
  status: string | null;
  ticket_url: string | null;
  rejection_reason?: string | null;
}

function toUSD(amount: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === "USD") return amount;
  const rate = rates[currency];
  if (!rate || rate <= 0) return null;
  return amount / rate;
}

function fromUSD(amountUsd: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === "USD") return amountUsd;
  const rate = rates[currency];
  if (!rate || rate <= 0) return null;
  return amountUsd * rate;
}

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  const usd = toUSD(amount, fromCurrency, rates);
  if (usd === null) return null;
  return fromUSD(usd, toCurrency, rates);
}

const CATEGORY_LABELS: Record<string, string> = {
  transport:       "Transporte",
  food:            "Comida y bebida",
  accommodation:   "Alojamiento",
  fuel:            "Combustible",
  communication:   "Comunicación",
  office_supplies: "Insumos de oficina",
  entertainment:   "Entretenimiento",
  other:           "Otros",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "Pendiente",
  approved:  "Aprobado",
  rejected:  "Rechazado",
  reviewing: "En revisión",
};

export function generateReportWorkbook(args: {
  employeeName: string;
  title: string | null;
  weekStart: string;
  weekEnd: string;
  closedAt: string | null;
  exchangeRates: Record<string, number>;
  budgetCurrency: string;
  expenses: ExpenseRow[];
}) {
  const {
    employeeName,
    title,
    weekStart,
    weekEnd,
    closedAt,
    exchangeRates,
    budgetCurrency,
    expenses,
  } = args;

  const startLabel = new Date(weekStart + "T12:00:00").toLocaleDateString("es-UY");
  const endLabel   = new Date(weekEnd   + "T12:00:00").toLocaleDateString("es-UY");

  const hasRates = Object.keys(exchangeRates).length > 0;

  const rows: any[][] = [];

  // ── Encabezado informativo ────────────────────────────────
  if (title) rows.push([`Rendición: ${title}`]);
  rows.push([`Empleado: ${employeeName}`]);
  rows.push([`Período: ${startLabel} — ${endLabel}`]);
  rows.push([`Cierre: ${closedAt ? new Date(closedAt).toLocaleDateString("es-UY") : "Abierta"}`]);
  rows.push([`Moneda de presupuesto: ${budgetCurrency}`]);
  if (hasRates) {
    const ratesSummary = Object.entries(exchangeRates)
      .map(([c, r]) => `1 USD = ${r} ${c}`)
      .join(" | ");
    rows.push([`Tipos de cambio: ${ratesSummary}`]);
  }
  rows.push([]);

  // ── Cabecera de columnas ──────────────────────────────────
  const headers = ["Fecha", "Categoría", "Descripción", "Comercio / Empresa", "Monto", "Moneda"];
  if (hasRates) headers.push("Equiv. USD");
  headers.push("Estado", "Motivo rechazo", "Comprobante");
  rows.push(headers);

  // ── Filas de gastos ───────────────────────────────────────
  const totalsByCurrency: Record<string, number> = {};
  let totalInBudgetCurrency = 0;
  let allConvertible = true;

  for (const e of expenses) {
    const amount   = Number(e.amount ?? 0);
    const currency = e.currency ?? "UYU";

    totalsByCurrency[currency] = (totalsByCurrency[currency] ?? 0) + amount;

    const inBudgetCurrency = convertAmount(
      amount,
      currency,
      budgetCurrency,
      exchangeRates,
    );
    if (inBudgetCurrency === null) allConvertible = false;
    else totalInBudgetCurrency += inBudgetCurrency;

    const row: any[] = [
      e.expense_date ? new Date(e.expense_date + "T12:00:00").toLocaleDateString("es-UY") : "",
      CATEGORY_LABELS[e.category] ?? e.category,
      e.description,
      e.merchant_name ?? "",
      amount,
      currency,
    ];
    if (hasRates) row.push(usd !== null ? Number(usd.toFixed(2)) : "—");
    row.push(
      STATUS_LABELS[e.status ?? "pending"] ?? e.status,
      e.rejection_reason ?? "",
      e.ticket_url ?? "",
    );
    rows.push(row);
  }

  // ── Totales ───────────────────────────────────────────────
  rows.push([]);

  const currenciesInReport = Object.keys(totalsByCurrency);
  const hasMultipleCurrencies = currenciesInReport.length > 1;

  // Si hay múltiples monedas, dejamos una aclaración explícita para evitar
  // interpretar un "total general" sumando montos de monedas distintas.
  if (hasMultipleCurrencies) {
    rows.push([
      "Nota: no se suman montos de diferentes monedas en un único total original.",
    ]);
  }

  // Subtotales por moneda original
  for (const [currency, total] of Object.entries(totalsByCurrency)) {
    const row: any[] = ["", "", "", `TOTAL ${currency}`, Number(total.toFixed(2)), currency];
    if (hasRates) row.push("");
    row.push("", "", "");
    rows.push(row);
  }

  // Total unificado en moneda de presupuesto (si hay tipo de cambio para todas las monedas)
  if (hasRates && allConvertible && expenses.length > 0) {
    const row: any[] = ["", "", "", `TOTAL ${budgetCurrency}`, "", ""];
    row.push(Number(totalInBudgetCurrency.toFixed(2)));
    row.push("", "", "");
    rows.push(row);
  }

  // ── Workbook ──────────────────────────────────────────────
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rendicion");

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buf);
}
