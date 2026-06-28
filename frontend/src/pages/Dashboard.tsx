import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Card, CardHeader, EmptyState, PageHeader, PageLoader } from "../components/ui";
import {
  IconArrowRight,
  IconCalendar,
  IconClients,
  IconMap,
  IconSparkle,
} from "../components/icons";

interface Summary {
  totalClients: number;
  totalLeads: number;
  totalProspects: number;
  totalArchived: number;
  conversionRate: number;
  leadsThisWeek: number;
  upcomingAppointments: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    client: { name: string; businessName?: string | null };
  }>;
  recentLeads: Array<{ id: string; name: string; category?: string | null; zone?: string | null }>;
  statusFunnel: Array<{ status: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
}

const STATUS_LABELS: Record<string, string> = {
  lead: "Leads",
  prospect: "Prospectos",
  client: "Clientes",
  inactive: "Inactivos",
  archived: "Archivados",
};

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-amber-400",
  prospect: "bg-brand-500",
  client: "bg-emerald-500",
  inactive: "bg-slate-300",
  archived: "bg-purple-400",
};

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>("/dashboard/summary").then((res) => setSummary(res.data));
  }, []);

  if (!summary) return <PageLoader />;

  const funnelTotal = summary.statusFunnel.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Resumen de tu actividad comercial en Codevia."
      />

      {/* Stat cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <IconClients />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{summary.totalClients}</p>
          <p className="mt-1 text-sm text-slate-500">Clientes activos</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <IconMap />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{summary.totalLeads}</p>
          <p className="mt-1 text-sm text-slate-500">Leads captados</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IconSparkle />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{summary.totalProspects}</p>
          <p className="mt-1 text-sm text-slate-500">Prospectos</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <span className="text-lg font-bold">%</span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{summary.conversionRate}%</p>
          <p className="mt-1 text-sm text-slate-500">Tasa de conversión</p>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {/* Pipeline funnel */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Pipeline de ventas"
            subtitle={`${summary.leadsThisWeek} nuevos contactos esta semana`}
            action={
              <Link
                to="/kanban"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Ver seguimiento <IconArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          <div className="space-y-3 px-5 py-4">
            {["lead", "prospect", "client", "archived", "inactive"].map((status) => {
              const row = summary.statusFunnel.find((r) => r.status === status);
              const count = row?.count ?? 0;
              const pct = Math.round((count / funnelTotal) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                    {STATUS_LABELS[status]}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${STATUS_COLORS[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top categorías */}
        <Card>
          <CardHeader title="Top categorías" />
          {summary.topCategories.length === 0 ? (
            <EmptyState icon={<IconMap />} title="Sin datos" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.topCategories.map((c, i) => (
                <li key={c.category} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-slate-700">{c.category}</span>
                  <span className="text-xs font-semibold text-slate-400">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximas citas */}
        <Card>
          <CardHeader
            title="Próximas citas"
            action={
              <Link
                to="/appointments"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Ver todas <IconArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {summary.upcomingAppointments.length === 0 ? (
            <EmptyState
              icon={<IconCalendar />}
              title="No hay citas próximas"
              description="Agenda una cita desde la ficha de un cliente."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.upcomingAppointments.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-center">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">
                      {new Date(a.scheduledAt).toLocaleDateString("es-ES", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-none text-slate-700">
                      {new Date(a.scheduledAt).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {a.client.businessName || a.client.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(a.scheduledAt).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Leads recientes */}
        <Card>
          <CardHeader
            title="Leads recientes"
            subtitle="Captados desde Google Maps"
            action={
              <Link
                to="/scraper"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Captar <IconArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {summary.recentLeads.length === 0 ? (
            <EmptyState
              icon={<IconSparkle />}
              title="Aún no hay leads"
              description="Lanza una búsqueda en Captación Maps para generar oportunidades."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.recentLeads.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-600">
                    {l.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/clients/${l.id}`}
                      className="truncate text-sm font-medium text-slate-800 hover:text-brand-600"
                    >
                      {l.name}
                    </Link>
                    <p className="truncate text-xs text-slate-400">
                      {[l.category, l.zone].filter(Boolean).join(" · ") || "Sin clasificar"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
