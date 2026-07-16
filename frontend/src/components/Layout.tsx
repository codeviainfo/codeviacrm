import { NavLink, Outlet, Navigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { cn, ThemeToggle } from "./ui";
import {
  IconCalendar,
  IconChart,
  IconClients,
  IconDashboard,
  IconKanban,
  IconLogout,
  IconMap,
  IconMenu,
  IconX,
} from "./icons";

const nav: Array<{ to: string; label: string; sublabel?: string; icon: ReactNode; end?: boolean }> = [
  { to: "/", label: "Dashboard", icon: <IconDashboard />, end: true },
  { to: "/clients", label: "Clientes", icon: <IconClients /> },
  { to: "/kanban", label: "Seguimiento", icon: <IconKanban /> },
  { to: "/appointments", label: "Citas", icon: <IconCalendar /> },
  { to: "/scraper", label: "Captación Maps", icon: <IconMap /> },
  { to: "/analytics", label: "Web Analytics", sublabel: "codeviaesp.com", icon: <IconChart /> },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Menú
      </p>
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
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
  );
}

function UserFooter({
  name,
  email,
  initials,
  onLogout,
}: {
  name: string;
  email: string;
  initials: string;
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
          <p className="truncate text-xs text-slate-400">{email}</p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <IconLogout className="h-[18px] w-[18px]" />
        Cerrar sesión
      </button>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

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
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-surface/80 backdrop-blur-sm lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/logo.png" alt="Codevia" className="h-9 w-9 object-contain" />
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-slate-900">Codevia</p>
            <p className="text-xs font-medium text-slate-400">CRM</p>
          </div>
          <ThemeToggle className="ml-auto" />
        </div>

        <NavItems />

        <UserFooter
          name={user.name || "Usuario"}
          email={user.email}
          initials={initials}
          onLogout={logout}
        />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col overflow-y-auto border-r border-slate-200 bg-surface shadow-soft">
            <div className="flex items-center gap-3 px-5 py-5">
              <img src="/logo.png" alt="Codevia" className="h-9 w-9 object-contain" />
              <div className="leading-tight">
                <p className="text-[15px] font-bold tracking-tight text-slate-900">Codevia</p>
                <p className="text-xs font-medium text-slate-400">CRM</p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <IconX />
              </button>
            </div>

            <NavItems onNavigate={() => setMenuOpen(false)} />

            <UserFooter
              name={user.name || "Usuario"}
              email={user.email}
              initials={initials}
              onLogout={logout}
            />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-surface/90 px-3 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Abrir menú"
          >
            <IconMenu />
          </button>
          <img src="/logo.png" alt="Codevia" className="h-7 w-7 object-contain" />
          <span className="truncate font-bold tracking-tight text-slate-900">Codevia CRM</span>
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
