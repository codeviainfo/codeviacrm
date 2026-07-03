import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Card, CardHeader, EmptyState, PageHeader, PageLoader, cn } from "../components/ui";
import { IconChart, IconGlobe, IconMail, IconSparkle } from "../components/icons";

interface Summary {
  totals: {
    sessions: number;
    pageviews: number;
    formSubmits: number;
    conversionRate: number;
  };
  visitsByDay: Array<{ date: string; sessions: number; pageviews: number }>;
  countries: Array<{ country: string | null; sessions: number }>;
  referrers: Array<{ referrer: string | null; sessions: number }>;
  utmSources: Array<{ source: string; sessions: number }>;
  devices: Array<{ device: string | null; sessions: number }>;
  funnel: { sessions: number; formStarts: number; formSubmits: number };
  topEvents: Array<{ type: string; name: string | null; count: number }>;
}

const PERIODS = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Móvil",
  tablet: "Tablet",
  desktop: "Ordenador",
};

const EVENT_LABELS: Record<string, string> = {
  form_start: "Empezó el formulario",
  form_submit: "Envió el formulario",
  form_error: "Error en el formulario",
  cta_click: "Clic en",
};

const CTA_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  cta_hero_presupuesto: "«Solicitar presupuesto» (hero)",
  cta_navbar_presupuesto: "«Solicitar presupuesto» (menú)",
};

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

function countryName(code: string | null) {
  if (!code) return "Desconocido";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function countryFlag(code: string | null) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function eventLabel(type: string, name: string | null) {
  if (type === "cta_click") return `${EVENT_LABELS.cta_click} ${CTA_LABELS[name ?? ""] ?? name ?? "CTA"}`;
  return EVENT_LABELS[type] ?? [type, name].filter(Boolean).join(" · ");
}

/** Fila con barra de proporción, usada en países / fuentes / dispositivos. */
function ShareRow({
  label,
  count,
  max,
  prefix,
}: {
  label: string;
  count: number;
  max: number;
  prefix?: string;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      {prefix && <span className="w-6 shrink-0 text-center text-base leading-none">{prefix}</span>}
      <span className="w-32 shrink-0 truncate text-sm text-slate-700" title={label}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">{count}</span>
    </li>
  );
}

export function WebAnalytics() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Summary>(`/analytics/summary?days=${days}`)
      .then((res) => setSummary(res.data))
      .finally(() => setLoading(false));
  }, [days]);

  if (!summary && loading) return <PageLoader />;
  if (!summary) return null;

  const maxDaily = Math.max(...summary.visitsByDay.map((d) => d.sessions), 1);
  const maxCountry = summary.countries[0]?.sessions ?? 0;
  const maxReferrer = Math.max(...summary.referrers.map((r) => r.sessions), 0);
  const maxDevice = Math.max(...summary.devices.map((d) => d.sessions), 0);
  const hasTraffic = summary.totals.sessions > 0;
  const { funnel } = summary;

  const funnelRows = [
    { label: "Visitas", count: funnel.sessions, cls: "bg-brand-500" },
    { label: "Empezaron el formulario", count: funnel.formStarts, cls: "bg-amber-400" },
    { label: "Enviaron el formulario", count: funnel.formSubmits, cls: "bg-emerald-500" },
  ];

  return (
    <div>
      <PageHeader
        title="Web Analytics"
        subtitle="Audiencia e interacciones de codeviaesp.com"
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-surface p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  days === p.days
                    ? "bg-brand-600 text-white"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Stat cards */}
      <div className={cn("mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4", loading && "opacity-60")}>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IconGlobe />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {summary.totals.sessions}
          </p>
          <p className="mt-1 text-sm text-slate-500">Visitas</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <IconChart />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {summary.totals.pageviews}
          </p>
          <p className="mt-1 text-sm text-slate-500">Páginas vistas</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <IconMail />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {summary.totals.formSubmits}
          </p>
          <p className="mt-1 text-sm text-slate-500">Formularios enviados</p>
        </Card>
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <span className="text-lg font-bold">%</span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            {summary.totals.conversionRate}%
          </p>
          <p className="mt-1 text-sm text-slate-500">Visita → formulario</p>
        </Card>
      </div>

      {/* Visitas por día */}
      <Card className="mb-6">
        <CardHeader
          title="Visitas por día"
          subtitle={`Últimos ${days} días · pasa el cursor para ver el detalle`}
        />
        {!hasTraffic ? (
          <EmptyState
            icon={<IconChart />}
            title="Todavía no hay visitas registradas"
            description="En cuanto la landing reciba tráfico con el tracking desplegado, verás aquí los datos."
          />
        ) : (
          <div className="flex h-44 items-end gap-px px-5 pb-4 pt-6">
            {summary.visitsByDay.map((d) => (
              <div
                key={d.date}
                className="group relative flex-1"
                title={`${new Date(d.date + "T00:00:00").toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}: ${d.sessions} visitas · ${d.pageviews} páginas vistas`}
              >
                <div
                  className="mx-auto w-full max-w-[26px] rounded-t bg-brand-500 transition-colors group-hover:bg-brand-700"
                  style={{ height: `${Math.max((d.sessions / maxDaily) * 140, d.sessions > 0 ? 4 : 1)}px` }}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Países */}
        <Card>
          <CardHeader title="Países" subtitle="De dónde visitan tu web" />
          {summary.countries.length === 0 ? (
            <EmptyState icon={<IconGlobe />} title="Sin datos" />
          ) : (
            <ul className="divide-y divide-slate-100 py-1">
              {summary.countries.map((c) => (
                <ShareRow
                  key={c.country ?? "unknown"}
                  label={countryName(c.country)}
                  prefix={countryFlag(c.country)}
                  count={c.sessions}
                  max={maxCountry}
                />
              ))}
            </ul>
          )}
        </Card>

        {/* Fuentes de tráfico */}
        <Card>
          <CardHeader title="Fuentes de tráfico" subtitle="Referrer de cada visita" />
          {summary.referrers.length === 0 ? (
            <EmptyState icon={<IconChart />} title="Sin datos" />
          ) : (
            <>
              <ul className="divide-y divide-slate-100 py-1">
                {summary.referrers.map((r) => (
                  <ShareRow
                    key={r.referrer ?? "direct"}
                    label={r.referrer ?? "Directo / sin referrer"}
                    count={r.sessions}
                    max={maxReferrer}
                  />
                ))}
              </ul>
              {summary.utmSources.length > 0 && (
                <div className="border-t border-slate-100">
                  <p className="px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Campañas (utm_source)
                  </p>
                  <ul className="divide-y divide-slate-100 py-1">
                    {summary.utmSources.map((u) => (
                      <ShareRow key={u.source} label={u.source} count={u.sessions} max={maxReferrer} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Embudo del formulario */}
        <Card>
          <CardHeader title="Embudo de conversión" subtitle="Visita → formulario enviado" />
          <div className="space-y-4 px-5 py-5">
            {funnelRows.map((row) => {
              const pct = funnel.sessions > 0 ? Math.round((row.count / funnel.sessions) * 100) : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-500">{row.label}</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {row.count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-2.5 rounded-full transition-all", row.cls)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Interacciones */}
        <Card>
          <CardHeader title="Interacciones" subtitle="Qué hacen los visitantes" />
          {summary.topEvents.length === 0 ? (
            <EmptyState icon={<IconSparkle />} title="Sin interacciones aún" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.topEvents.map((e, i) => (
                <li key={`${e.type}-${e.name}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 truncate text-sm text-slate-700">
                    {eventLabel(e.type, e.name)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Dispositivos */}
        <Card>
          <CardHeader title="Dispositivos" />
          {summary.devices.length === 0 ? (
            <EmptyState icon={<IconChart />} title="Sin datos" />
          ) : (
            <ul className="divide-y divide-slate-100 py-1">
              {summary.devices
                .slice()
                .sort((a, b) => b.sessions - a.sessions)
                .map((d) => (
                  <ShareRow
                    key={d.device ?? "unknown"}
                    label={DEVICE_LABELS[d.device ?? ""] ?? "Desconocido"}
                    count={d.sessions}
                    max={maxDevice}
                  />
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
