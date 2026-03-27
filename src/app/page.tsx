type SearchParams = {
  error?: string;
  error_code?: string;
  error_description?: string;
};

function friendlyAuthLinkError(params: SearchParams) {
  const code = (params.error_code ?? "").toLowerCase();
  if (code === "otp_expired") {
    return "El enlace para recuperar tu contraseña expiró o ya fue usado. Pedí uno nuevo.";
  }
  if (params.error || params.error_description) {
    return "No pudimos validar el enlace. Probá solicitando uno nuevo.";
  }
  return null;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const msg = friendlyAuthLinkError(params);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="card w-full max-w-xl p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-[var(--color-text-primary)]">
          Rendición SG
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Gestión moderna de rendición de gastos para empleados y vendedores.
        </p>
        {msg && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
            <p className="font-semibold">Hubo un problema con el enlace</p>
            <p className="mt-1">{msg}</p>
            <div className="mt-3">
              <a href="/forgot-password" className="text-[var(--color-primary)] font-semibold hover:underline">
                Volver a pedir el enlace
              </a>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
          <a href="/login" className="btn-primary w-full sm:w-auto">
            Iniciar sesión
          </a>
          <a
            href="/register"
            className="w-full rounded-full border border-[#e5e2ea] bg-white px-5 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[#f5f1f8] sm:w-auto"
          >
            Crear cuenta
          </a>
        </div>
      </div>
    </div>
  );
}
