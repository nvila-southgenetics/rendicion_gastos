'use client';

import { useFormStatus } from "react-dom";

export function SubmitReportButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-shimmer relative inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[var(--color-primary)] px-4 py-2 text-center text-xs font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 sm:w-auto"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Enviando...
        </span>
      ) : (
        "Cerrar y enviar rendición"
      )}
    </button>
  );
}
