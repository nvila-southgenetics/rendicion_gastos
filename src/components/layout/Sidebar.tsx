'use client';
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Receipt, FileSpreadsheet, Users, Eye, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const baseNavItems = [
  { href: "/dashboard",            label: "Resumen",     icon: LayoutDashboard, adminOnly: false, supervisorOnly: false, viewerOnly: false },
  { href: "/dashboard/reports",    label: "Rendiciones", icon: FileSpreadsheet, adminOnly: false, supervisorOnly: false, viewerOnly: false },
  { href: "/dashboard/expenses",   label: "Histórico",   icon: Receipt,         adminOnly: false, supervisorOnly: false, viewerOnly: false },
  { href: "/dashboard/aprobador",  label: "Aprobaciones",icon: Eye,             adminOnly: false, supervisorOnly: true,  viewerOnly: false },
  { href: "/dashboard/viewer",     label: "Ver rend.",   icon: Eye,             adminOnly: false, supervisorOnly: false, viewerOnly: true  },
  { href: "/dashboard/admin",      label: "Admin",       icon: Users,           adminOnly: true,  supervisorOnly: false, viewerOnly: false },
];

export function Sidebar({ isAdmin = false, isSupervisor = false, isViewer = false }: { isAdmin?: boolean; isSupervisor?: boolean; isViewer?: boolean }) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createSupabaseBrowserClient();

  const navItems = baseNavItems.filter((item) => {
    if (item.adminOnly)       return isAdmin;
    if (item.supervisorOnly)  return isSupervisor;
    if (item.viewerOnly)      return isViewer;
    return true;
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-[var(--color-primary)] text-[var(--color-text-on-primary)] px-5 py-6">
      <div className="mb-8">
        <div className="text-lg font-semibold tracking-tight">Rendición SG</div>
        <div className="text-xs text-white/70 mt-1">Control de gastos</div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isRootDashboard = item.href === "/dashboard";
          const active = isRootDashboard
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white text-[var(--color-primary)]"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-white/20 pt-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

