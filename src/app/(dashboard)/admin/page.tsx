import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/auth/getMyProfile";
import { GlobalExchangeRateEditor } from "@/components/admin/GlobalExchangeRateEditor";

export default async function AdminHomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);
  if (me?.role !== "admin") redirect("/dashboard");

  const [
    { data: users },
    { data: pendingExpenses },
    { data: reviewingExpenses },
    { data: openReports },
    { data: presets },
  ] = await Promise.all([
    supabase.from("profiles").select("id"),
    supabase.from("expenses").select("id").eq("status", "pending"),
    supabase.from("expenses").select("id").eq("status", "reviewing"),
    supabase.from("weekly_reports").select("id").eq("status", "open"),
    supabase.from("exchange_rate_presets").select("currency, rate"),
  ]);

  const stats = [
    { label: "Usuarios",             value: users?.length ?? 0,             color: "text-[var(--color-primary)]" },
    { label: "Rendiciones abiertas", value: openReports?.length ?? 0,       color: "text-emerald-600" },
    { label: "Gastos pendientes",    value: pendingExpenses?.length ?? 0,   color: "text-amber-600" },
    { label: "En revisión",          value: reviewingExpenses?.length ?? 0, color: "text-blue-600" },
  ];

  // Convertir array de presets a objeto { UYU: 43, ARS: 1000, ... }
  const initialRates: Record<string, number> = {};
  for (const p of presets ?? []) {
    initialRates[p.currency] = Number(p.rate);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Panel administrador</h1>
        <p className="page-subtitle">Resumen global y configuración.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className="text-[0.7rem] font-semibold uppercase text-[var(--color-text-muted)]">
              {s.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tipos de cambio globales */}
      <GlobalExchangeRateEditor initialRates={initialRates} />

      {/* Acciones rápidas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/reports"
          className="card flex items-center gap-4 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
            <svg className="h-6 w-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">Revisar rendiciones</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Ver todas las rendiciones y validar gastos
            </p>
          </div>
          <span className="ml-auto text-[var(--color-text-muted)]">›</span>
        </Link>

        <Link
          href="/admin/users"
          className="card flex items-center gap-4 p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-secondary)]/10">
            <svg className="h-6 w-6 text-[var(--color-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">Gestionar usuarios</p>
            <p className="text-xs text-[var(--color-text-muted)]">Roles y asignaciones de supervisión</p>
          </div>
          <span className="ml-auto text-[var(--color-text-muted)]">›</span>
        </Link>
      </div>
    </div>
  );
}
