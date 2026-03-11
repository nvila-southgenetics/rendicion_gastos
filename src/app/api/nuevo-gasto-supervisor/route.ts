import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL_NUEVO_GASTO;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!WEBHOOK_URL) {
    return NextResponse.json(
      { error: "N8N webhook URL not configured" },
      { status: 500 }
    );
  }

  const { expenseId } = (await req.json()) as { expenseId?: string };

  if (!expenseId) {
    return NextResponse.json(
      { error: "expenseId is required" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  // Obtener gasto + empleado
  const { data: expense } = await supabase
    .from("expenses")
    .select("id, amount, description, user_id")
    .eq("id", expenseId)
    .maybeSingle();

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const { data: employee } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", expense.user_id)
    .maybeSingle();

  // Supervisores asignados al empleado
  const { data: assignments } = await supabase
    .from("supervision_assignments")
    .select("supervisor_id")
    .eq("employee_id", expense.user_id);

  if (!assignments || assignments.length === 0) {
    return NextResponse.json(
      { ok: true, message: "No supervisors assigned, skipping webhook" },
      { status: 200 }
    );
  }

  const supervisorIds = assignments.map((a) => a.supervisor_id);

  const { data: supervisors } = await supabase
    .from("profiles")
    .select("email")
    .in("id", supervisorIds);

  if (!supervisors || supervisors.length === 0) {
    return NextResponse.json(
      { ok: true, message: "No supervisor emails found, skipping webhook" },
      { status: 200 }
    );
  }

  const supervisorEmails = supervisors
    .map((s) => s.email)
    .filter(Boolean)
    .join(",");

  const payload = {
    expenseId: expense.id,
    employeeName: employee?.full_name ?? "",
    amount: Number(expense.amount ?? 0),
    description: expense.description ?? "",
    supervisorEmails,
  };

  try {
    await fetch(WEBHOOK_URL as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error enviando webhook a n8n:", error);
    // No propagamos el error al cliente
  }

  return NextResponse.json({ ok: true });
}

