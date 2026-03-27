'use client';

import { useRouter } from "next/navigation";

interface OpenReportCardProps {
  reportId: string;
  title: string | null;
  totalOpen: number | null;
  weekStart: string;
  weekEnd: string;
}

export function OpenReportCard({ reportId, title, totalOpen, weekStart, weekEnd }: OpenReportCardProps) {
  const router = useRouter();

  const startLabel = new Date(weekStart + "T12:00:00").toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
  });
  const endLabel = new Date(weekEnd + "T12:00:00").toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
  });

  function goToReport() {
    router.push(`/dashboard/reports/${reportId}`);
  }

  function goToNewExpense(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/dashboard/expenses/new?reportId=${reportId}`);
  }

  return (
    <div
      onClick={goToReport}
      className="card box-border flex w-full max-w-full cursor-pointer flex-col gap-3 p-3 text-left transition-transform active:scale-[0.98] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
    >
      <div className="min-w-0 max-w-full flex-1">
        <p className="text-[0.7rem] font-semibold uppercase text-[var(--color-text-muted)]">
          Rendición activa
        </p>
        {title && (
          <p className="mt-0.5 max-w-full truncate text-base font-bold text-[var(--color-text-primary)]">
            {title}
          </p>
        )}
        <p
          className={`truncate ${
            title ? "text-sm" : "mt-0.5 text-lg font-bold"
          } text-[var(--color-primary)]`}
        >
          {totalOpen !== null
            ? `$ ${totalOpen.toLocaleString("es-UY", { minimumFractionDigits: 2 })} UYU`
            : "Sin gastos aún"}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {startLabel} – {endLabel}
        </p>
      </div>
      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
        <span className="badge self-start bg-emerald-100 text-emerald-700 sm:self-auto">
          Abierta
        </span>
        <button
          type="button"
          onClick={goToNewExpense}
          className="btn-primary box-border w-full text-center text-xs py-2 px-3 sm:w-auto sm:px-4"
        >
          + Gasto
        </button>
      </div>
    </div>
  );
}
