'use client';

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface BackButtonProps {
  href: string;
  label?: string;
}

export function BackButton({ href, label = "Volver" }: BackButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);

  const loading = isPending || clicked;

  return (
    <button
      type="button"
      onClick={() => {
        setClicked(true);
        startTransition(() => {
          router.push(href);
        });
      }}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-full border border-[#e5e2ea] bg-white px-3 py-1 text-[0.7rem] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[#f5f1f8] disabled:opacity-70"
    >
      {loading ? (
        <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
