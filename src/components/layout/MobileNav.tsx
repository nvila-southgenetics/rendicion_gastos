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

export function MobileNav({ isAdmin = false, isSupervisor = false, isViewer = false }: { isAdmin?: boolean; isSupervisor?: boolean; isViewer?: boolean }) {
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
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[#e5e2ea] bg-white/95 px-2 py-2.5 md:hidden">
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
            className={`flex flex-col items-center text-xs ${
              active ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            <span
              className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full ${
                active ? "bg-[var(--color-bg)]" : ""
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button
        onClick={handleSignOut}
        className="flex flex-col items-center text-xs text-[var(--color-text-muted)]"
      >
        <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-full">
          <LogOut className="h-4 w-4" />
        </span>
        <span>Salir</span>
      </button>
    </nav>
  );
}
