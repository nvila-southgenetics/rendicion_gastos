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
      className="card flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left active:scale-[0.98] transition-transform"
    >
      <div>
        <p className="text-[0.7rem] font-semibold uppercase text-[var(--color-text-muted)]">
          Rendición activa
        </p>
        {title && (
          <p className="mt-0.5 text-base font-bold text-[var(--color-text-primary)]">
            {title}
          </p>
        )}
        <p
          className={`${
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
      <div className="flex flex-col items-end gap-2">
        <span className="badge bg-emerald-100 text-emerald-700">Abierta</span>
        <button
          type="button"
          onClick={goToNewExpense}
          className="btn-primary text-xs py-2 px-4"
        >
          + Gasto
        </button>
      </div>
    </div>
  );
}

