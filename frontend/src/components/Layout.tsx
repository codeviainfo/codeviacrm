import { NavLink, Outlet, Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { cn, ThemeToggle } from "./ui";
import {
  IconBriefcase,
  IconCalendar,
  IconChart,
  IconClients,
  IconDashboard,
  IconKanban,
  IconLogout,
  IconMap,
  IconPalette,
} from "./icons";

const nav: Array<{ to: string; label: string; sublabel?: string; icon: ReactNode; end?: boolean }> = [
  { to: "/", label: "Dashboard", icon: <IconDashboard />, end: true },
  { to: "/clients", label: "Clientes", icon: <IconClients /> },
  { to: "/kanban", label: "Seguimiento", icon: <IconKanban /> },
  { to: "/trabajos", label: "Trabajos", icon: <IconBriefcase /> },
  { to: "/appointments", label: "Citas", icon: <IconCalendar /> },
  { to: "/scraper", label: "Captación Maps", icon: <IconMap /> },
  { to: "/designs", label: "Diseño", icon: <IconPalette /> },
  { to: "/analytics", label: "Web Analytics", sublabel: "codeviaesp.com", icon: <IconChart /> },
];

export function Layout() {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const initials =
    (user.name || user.email || "?")
      .split(" ")
      .map((p: string) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-surface/80 backdrop-blur-sm lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/logo.png" alt="Codevia" className="h-9 w-9 object-contain" />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-slate-900">Codevia</p>
            <p className="text-xs font-medium text-slate-400">CRM</p>
          </div>
          <ThemeToggle className="ml-auto" />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Menú
          </p>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "transition-colors",
                      isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="flex flex-col leading-tight">
                    {item.label}
                    {item.sublabel && (
                      <span className="text-[10px] font-normal text-slate-400">{item.sublabel}</span>
                    )}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-800">
                {user.name || "Usuario"}
              </p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <IconLogout className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <img src="/logo.png" alt="Codevia" className="h-7 w-7 object-contain" />
          <span className="font-bold tracking-tight text-slate-900">Codevia CRM</span>
          <ThemeToggle className="ml-auto" />
          <button
            onClick={logout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar sesión"
          >
            <IconLogout />
          </button>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
