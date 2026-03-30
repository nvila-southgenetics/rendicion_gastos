'use client';

import { useFormStatus } from "react-dom";

interface Props {
  allExpensesApproved: boolean;
}

export function ApproveReportButton({ allExpensesApproved }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={!allExpensesApproved || pending}
      className="btn-shimmer relative w-full overflow-hidden rounded-full bg-emerald-500 px-4 py-2 text-center text-xs font-semibold text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      title={
        !allExpensesApproved
          ? "Debes aprobar todos los gastos individuales primero"
          : "Aprobar Rendición Completa"
      }
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Aprobando...
        </span>
      ) : (
        allExpensesApproved ? "Aprobar rendición" : "Aprobar gastos pendientes..."
      )}
    </button>
  );
}
