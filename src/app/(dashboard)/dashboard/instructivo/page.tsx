import { BackButton } from "@/components/ui/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/auth/getMyProfile";

export default async function InstructivoPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const me = await getMyProfile(supabase, session);
  const role = me?.role ?? "employee";
  const isAprobador = role === "aprobador" || role === "supervisor";
  const isPagador = role === "pagador";
  const isAdmin = role === "admin";

  const steps = [
    {
      number: 1,
      title: "Crear una rendición",
      description:
        "Desde el dashboard, presioná \"Crear\" o andá a Rendiciones y creá una nueva. Asignale un título y un período.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="M9 15h6" />
        </svg>
      ),
    },
    {
      number: 2,
      title: "Agregar gastos",
      description:
        "Dentro de la rendición, usá el botón \"+ Agregar gasto\". Completá descripción, monto, categoría y subí el comprobante.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M8 10h8" />
          <path d="M8 14h4" />
        </svg>
      ),
    },
    {
      number: 3,
      title: "Adjuntar comprobantes",
      description:
        "Cada gasto debe tener un comprobante adjunto (foto o PDF). Podés subirlo desde tu celular o computadora.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      ),
    },
    {
      number: 4,
      title: "Cerrar y enviar",
      description:
        "Cuando tengas todos los gastos cargados, presioná \"Cerrar y enviar rendición\". Tu aprobador será notificado.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4Z" />
        </svg>
      ),
    },
    {
      number: 5,
      title: "Revisión y aprobación",
      description:
        "Tu aprobador revisará cada gasto. Puede aprobar, rechazar (con motivo) o pedir correcciones. Te llegará una notificación.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    },
    {
      number: 6,
      title: "Corregir si es necesario",
      description:
        "Si un gasto es rechazado o requiere corrección, editalo desde la rendición y volvé a enviar.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      ),
    },
    {
      number: 7,
      title: "Pago",
      description:
        "Una vez aprobada la rendición, el pagador registra el pago y adjunta el comprobante. Recibirás confirmación.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
  ];

  const tips = [
    { label: "Subí comprobantes legibles", detail: "Fotos nítidas o PDFs escaneados. Evitá imágenes borrosas." },
    { label: "Categoría correcta", detail: "Elegí la categoría que mejor represente el gasto para facilitar la aprobación." },
    { label: "Descripción clara", detail: "Indicá qué fue el gasto y con qué empresa/comercio. Ej: \"Almuerzo con cliente - Rest. Don Pedro\"." },
    { label: "Moneda correcta", detail: "Asegurate de seleccionar la moneda en la que pagaste (UYU, USD, ARS, etc.)." },
  ];

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="space-y-3">
        <BackButton href="/dashboard" />

        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[var(--color-text-primary)] sm:text-xl">Instructivo</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            Guía paso a paso para rendir tus gastos correctamente.
          </p>
        </div>
      </div>

      {/* Pasos */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.number} className="card flex gap-4 p-4 max-[430px]:gap-3 max-[430px]:p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f5f1f8] text-[var(--color-primary)] sm:h-12 sm:w-12">
              {step.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[0.6rem] font-bold text-white">
                  {step.number}
                </span>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{step.title}</h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="card w-full space-y-3 border-l-4 border-[var(--color-secondary)] p-4 max-[430px]:p-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Tips para una rendición exitosa</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <div key={tip.label} className="flex gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-[var(--color-secondary)]" aria-hidden="true">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">{tip.label}</p>
                <p className="text-[0.7rem] leading-relaxed text-[var(--color-text-muted)]">{tip.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Descargas */}
      <div className="card w-full space-y-3 p-4 max-[430px]:p-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Descargar instructivos</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Descargá el instructivo en PDF según tu rol para consultarlo cuando lo necesites.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a
            href="/instructivos/Rendiciones - Instructivo para Empleado.pdf"
            download
            className="inline-flex items-center gap-2 rounded-xl border border-[#e5e2ea] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[#f5f1f8]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-primary)]" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Instructivo &quot;Empleado&quot;
          </a>

          {(isAprobador || isAdmin) && (
            <a
              href="/instructivos/Rendiciones - Instructivo Aprobador.pdf"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-[#e5e2ea] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[#f5f1f8]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-purple-600" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Instructivo &quot;Aprobador&quot;
            </a>
          )}

          {(isPagador || isAdmin) && (
            <a
              href="/instructivos/Rendiciones - Instructivo Pagador.pdf"
              download
              className="inline-flex items-center gap-2 rounded-xl border border-[#e5e2ea] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[#f5f1f8]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-600" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Instructivo &quot;Pagador&quot;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
