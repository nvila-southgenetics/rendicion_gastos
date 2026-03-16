import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  let isAdmin      = false;
  let isSupervisor = false;
  let isViewer     = false;
  if (session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    isAdmin      = profile?.role === "admin";
    isSupervisor = profile?.role === "aprobador";
    isViewer     = profile?.role === "chusmas";
  }

  return (
    <div className="app-shell">
      <Sidebar isAdmin={isAdmin} isSupervisor={isSupervisor} isViewer={isViewer} />
      <div className="flex min-h-screen flex-1 flex-col bg-[var(--color-bg)] pb-14 md:pb-0">
        <Header />
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          {children}
        </main>
        <MobileNav isAdmin={isAdmin} isSupervisor={isSupervisor} isViewer={isViewer} />
      </div>
    </div>
  );
}
