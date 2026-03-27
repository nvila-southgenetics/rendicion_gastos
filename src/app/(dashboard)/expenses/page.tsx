import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpenseStatusBadge } from "@/components/expenses/ExpenseStatusBadge";
import type { Tables } from "@/types/database";

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

export default async function ExpensesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", session.user.id)
    .order("expense_date", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Histórico de gastos</h1>
        <p className="page-subtitle">Todos los gastos registrados en tus rendiciones.</p>
      </div>

      {expenses && expenses.length > 0 ? (
        <>
          {/* Cards — mobile */}
          <div className="space-y-2 lg:hidden">
            {(expenses as Expense[]).map((expense) => (
              <Link
                key={expense.id}
                href={`/dashboard/expenses/${expense.id}`}
                className="card block w-full p-4 active:scale-[0.98] transition-transform"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-snug break-words whitespace-normal text-[var(--color-text-primary)]">
                    {expense.description}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {CATEGORY_LABELS[expense.category] ?? expense.category}
                    {" · "}
                    {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[var(--color-text-primary)] whitespace-nowrap">
                    {Number(expense.amount).toLocaleString("es-UY", { minimumFractionDigits: 2 })}{" "}
                    <span className="text-xs font-normal text-[var(--color-text-muted)]">
                      {expense.currency ?? "UYU"}
                    </span>
                  </span>
                  <div className="shrink-0">
                    <ExpenseStatusBadge status={expense.status ?? "pending"} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Tabla — desktop */}
          <div className="card hidden overflow-hidden lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f5f1f8] text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium text-right">Monto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(expenses as Expense[]).map((expense) => (
                  <tr key={expense.id} className="border-t border-[#f0ecf4] hover:bg-[#faf7fd] transition-colors">
                    <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                      {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-UY")}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Link href={`/dashboard/expenses/${expense.id}`} className="text-sm font-medium hover:text-[var(--color-primary)]">
                        {expense.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle text-xs text-[var(--color-text-muted)]">
                      {CATEGORY_LABELS[expense.category] ?? expense.category}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-sm font-semibold whitespace-nowrap">
                      {Number(expense.amount).toLocaleString("es-UY", { minimumFractionDigits: 2 })}{" "}
                      {expense.currency ?? "UYU"}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ExpenseStatusBadge status={expense.status ?? "pending"} />
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      {expense.status === "pending" && (
                        <Link href={`/dashboard/expenses/${expense.id}/edit`} className="text-xs font-medium text-[var(--color-primary)] hover:underline">
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <span className="text-4xl">🧾</span>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin gastos registrados</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Los gastos aparecen acá cuando los cargás desde una rendición.
          </p>
          <Link href="/dashboard/reports" className="btn-primary mt-1 text-sm">
            Ir a Rendiciones
          </Link>
        </div>
      )}
    </div>
  );
}
