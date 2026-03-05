"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Sesión iniciada");
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-primary)]">
          Email
        </label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-[var(--color-text-primary)]">
          Contraseña
        </label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={loading}
      >
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="mb-2 text-xl font-semibold text-[var(--color-text-primary)]">
          Iniciar sesión
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Accede a tu panel de rendición de gastos.
        </p>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-[#f5f1f8]" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
          ¿No tienes cuenta?{" "}
          <a href="/register" className="text-[var(--color-primary)]">
            Registrarse
          </a>
        </p>
      </div>
    </div>
  );
}

