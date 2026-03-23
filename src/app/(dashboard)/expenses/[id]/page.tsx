import { notFound } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import { SupervisorExpenseActions } from "@/components/expenses/SupervisorExpenseActions";
import type { Tables, TablesUpdate } from "@/types/database";

type Expense = Tables<"expenses">;

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

interface ExpenseDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function ExpenseDetailPage({ params, searchParams }: ExpenseDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = query.returnTo ?? "/dashboard/expenses";
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const [{ data: me }, { data: expense }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", session.user.id)
      .single(),
    supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!expense) notFound();

  const e = expense as Expense;
  const isOwner = e.user_id === session.user.id;
  const canEditOwn =
    isOwner && (e.status === "pending" || e.status === "reviewing");

  // Solo permitir acciones del aprobador si la rendición asociada fue enviada
  let canShowAprobadorActions = false;
  if (!isOwner && (me?.role === "aprobador" || me?.role === "admin")) {
    const { data: reportForExpense } = await supabase
      .from("weekly_reports")
      .select("workflow_status")
      .eq("id", e.report_id)
      .maybeSingle();

    const workflowStatus = (reportForExpense?.workflow_status ?? "draft") as
      | "draft"
      | "submitted"
      | "needs_correction"
      | "approved"
      | "paid";

    canShowAprobadorActions = workflowStatus === "submitted";
  }

  const normalizedReturnTo =
    returnTo.startsWith("/dashboard/supervisor")
      ? returnTo.replace("/dashboard/supervisor", "/dashboard/aprobador")
      : returnTo;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Detalle de gasto</h1>
          <p className="page-subtitle">{e.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExpenseStatusBadge status={e.status ?? "pending"} />
          {canEditOwn && (
            <Link
              href={`/dashboard/expenses/${e.id}/edit`}
              className={`text-xs font-semibold inline-flex items-center rounded-full px-3 py-1.5 transition-colors ${
                e.status === "reviewing"
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "btn-primary text-sm"
              }`}
            >
              {e.status === "reviewing" ? "Corregir y reenviar" : "Editar"}
            </Link>
          )}
        </div>
      </div>

      {isOwner && e.status === "reviewing" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Este gasto fue marcado para revisión por tu aprobador. Revisá los datos,
          corregí lo necesario y usá <span className="font-semibold">“Corregir y reenviar”</span> para que vuelva a aprobarlo.
        </div>
      )}

      {canShowAprobadorActions && (
        <SupervisorExpenseActions
          expenseId={e.id}
          currentStatus={(e.status ?? "pending") as "pending" | "approved" | "rejected" | "reviewing"}
          updateStatus={updateExpenseStatusAction}
        />
      )}

      <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
        {/* Datos del gasto */}
        <div className="card p-5 space-y-3 text-sm">
          <Row label="Descripción" value={e.description} />
          {e.merchant_name && (
            <Row label="Comercio / Empresa" value={e.merchant_name} />
          )}
          <Row
            label="Monto"
            value={`${Number(e.amount).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${e.currency ?? "UYU"}`}
          />
          <Row
            label="Fecha"
            value={new Date(e.expense_date + "T12:00:00").toLocaleDateString("es-UY")}
          />
          <Row label="Categoría" value={CATEGORY_LABELS[e.category] ?? e.category} />
          {e.supervisor_comment && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-600 mb-1">
                Motivo del aprobador
              </p>
              <p className="text-sm text-amber-700">{e.supervisor_comment}</p>
            </div>
          )}
          {e.rejection_reason && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-red-600 mb-1">Motivo de rechazo</p>
              <p className="text-sm text-red-700">{e.rejection_reason}</p>
            </div>
          )}
          {e.employee_response && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-emerald-600 mb-1">
                Respuesta del rendidor (reenvío)
              </p>
              <p className="text-sm text-emerald-700">{e.employee_response}</p>
            </div>
          )}
          {e.admin_notes && e.status === "reviewing" && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-600 mb-1">Comentario del administrador</p>
              <p className="text-sm text-blue-700">{e.admin_notes}</p>
            </div>
          )}
        </div>

        {/* Comprobante(s) */}
        <div className="card p-5 space-y-3 text-sm">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Comprobantes
            {(e.ticket_urls?.length ?? (e.ticket_url ? 1 : 0)) > 1 && (
              <span className="ml-1.5 rounded-full bg-[#f0ecf4] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--color-text-muted)]">
                {e.ticket_urls!.length}
              </span>
            )}
          </h2>
          {(() => {
            const urls = e.ticket_urls ?? (e.ticket_url ? [e.ticket_url] : []);
            if (urls.length === 0) {
              return <p className="text-xs text-[var(--color-text-muted)]">No hay comprobante adjunto.</p>;
            }
            if (urls.length === 1) {
              return (
                <a href={urls[0]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[0]} alt="Comprobante" className="w-full rounded-xl border border-[#e5e2ea] object-cover max-h-64" />
                  <span className="mt-1.5 block text-xs text-[var(--color-primary)] underline underline-offset-2">Ver imagen completa ↗</span>
                </a>
              );
            }
            return (
              <div className="grid grid-cols-2 gap-2">
                {urls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-[#e5e2ea] bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Comprobante ${i + 1}`} className="aspect-square w-full object-cover transition-opacity group-hover:opacity-90" />
                    <span className="absolute bottom-1 right-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[0.6rem] text-white">
                      {i + 1} ↗
                    </span>
                  </a>
                ))}
              </div>
            );
          })()}
          {e.ocr_extracted_text && (
            <div>
              <p className="mt-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                Texto extraído (OCR)
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--color-text-muted)]">
                {e.ocr_extracted_text}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={normalizedReturnTo}
          className="inline-flex items-center gap-1 rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-[0.8rem] font-semibold text-[var(--color-primary)] hover:bg-[#f5f1f8]"
        >
          <span>←</span>
          <span>
            {normalizedReturnTo.startsWith("/dashboard/aprobador")
              ? "Volver a la rendición"
              : "Volver a mis gastos"}
          </span>
        </Link>
      </div>
    </div>
  );
}

async function updateExpenseStatusAction(
  expenseId: string,
  status: "pending" | "approved" | "rejected" | "reviewing",
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "No hay sesión activa." };
  }

  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .select("id, user_id, amount, description, report_id")
    .eq("id", expenseId)
    .maybeSingle();

  if (expenseError || !expense) {
    return { ok: false, error: "Gasto no encontrado." };
  }

  // Verificar que la rendición asociada esté enviada al aprobador
  const { data: reportForExpense } = await supabase
    .from("weekly_reports")
    .select("workflow_status")
    .eq("id", expense.report_id)
    .maybeSingle();

  const workflowStatus = (reportForExpense?.workflow_status ?? "draft") as
    | "draft"
    | "submitted"
    | "needs_correction"
    | "approved"
    | "paid";

  if (workflowStatus !== "submitted") {
    return {
      ok: false,
      error:
        "Solo se pueden aprobar o revisar gastos de rendiciones que ya fueron enviadas al aprobador.",
    };
  }

  const updates: TablesUpdate<"expenses"> = {
    status,
    supervisor_comment: comment || null,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
    rejection_reason: status === "rejected" ? (comment || null) : null,
  };

  const { error: updateError } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", expenseId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Nota: ya no se envían webhooks por gasto individual (aprobación/rechazo/revisión).
  // Fuerza a Next.js a re-renderizar Server Components con datos frescos.
  revalidatePath("/dashboard/expenses");
  revalidatePath(`/dashboard/expenses/${expenseId}`);
  if (expense.report_id) {
    revalidatePath(`/dashboard/reports/${expense.report_id}`);
  }

  return { ok: true };
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
