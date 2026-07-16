import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Service, ServiceStatus } from "../api/types";
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "../components/ui";
import { IconBriefcase, IconDownload, IconSearch } from "../components/icons";
import { generateBudgetPdf } from "../lib/budgetPdf";
import { SERVICE_STATUS_CLS, SERVICE_STATUS_LABEL, fmtDate, fmtMoney } from "../lib/service";

const STATUS_TILE_ICON_CLS: Record<ServiceStatus, string> = {
  pending: "bg-amber-50 text-amber-600",
  completed: "bg-emerald-50 text-emerald-600",
  invoiced: "bg-brand-50 text-brand-600",
};

export function Trabajos() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (status) params.status = status;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await api.get<Service[]>("/services", { params });
      setServices(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dateFrom, dateTo]);

  useEffect(() => {
    setSelected(new Set());
  }, [services]);

  const stats = useMemo(() => {
    const byStatus: Record<ServiceStatus, { count: number; total: number }> = {
      pending: { count: 0, total: 0 },
      completed: { count: 0, total: 0 },
      invoiced: { count: 0, total: 0 },
    };
    let grandTotal = 0;
    for (const s of services) {
      const amount = s.quantity * s.unitPrice;
      byStatus[s.status].count += 1;
      byStatus[s.status].total += amount;
      grandTotal += amount;
    }
    return { byStatus, grandTotal };
  }, [services]);

  const selectedServices = services.filter((s) => selected.has(s.id));
  const selectedClientIds = new Set(selectedServices.map((s) => s.clientId));
  const canGenerate = selectedServices.length > 0 && selectedClientIds.size === 1;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateBudget() {
    if (!canGenerate) return;
    const client = selectedServices[0].client;
    if (!client) return;
    setGeneratingPdf(true);
    try {
      await generateBudgetPdf(client, selectedServices);
      setSelected(new Set());
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Trabajos"
        subtitle="Todos los trabajos realizados para tus clientes, en una vista general."
      />

      {/* Stat tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["pending", "completed", "invoiced"] as ServiceStatus[]).map((st) => (
          <Card key={st} className="p-5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${STATUS_TILE_ICON_CLS[st]}`}>
              <IconBriefcase />
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              {stats.byStatus[st].count}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {SERVICE_STATUS_LABEL[st]} · {fmtMoney(stats.byStatus[st].total)}
            </p>
          </Card>
        ))}
        <Card className="p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <IconBriefcase />
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{services.length}</p>
          <p className="mt-1 text-sm text-slate-500">Total · {fmtMoney(stats.grandTotal)}</p>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por trabajo o cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="completed">Completado</option>
          <option value="invoiced">Facturado</option>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="sm:w-40" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="sm:w-40" />
      </div>

      <Card className="overflow-hidden">
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="w-10 px-5 py-3" />
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Trabajo</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3 text-right">Importe</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {services.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/clients/${s.clientId}`}
                      className="font-medium text-slate-800 hover:text-brand-600"
                    >
                      {s.client?.businessName || s.client?.name || "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{s.title}</p>
                    {s.description && <p className="text-xs text-slate-400">{s.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{fmtDate(s.date)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-700">
                    {fmtMoney(s.quantity * s.unitPrice)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${SERVICE_STATUS_CLS[s.status]}`}
                    >
                      {SERVICE_STATUS_LABEL[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && services.length === 0 && (
          <EmptyState
            icon={<IconBriefcase />}
            title="No hay trabajos"
            description="No se encontraron trabajos que coincidan con el filtro."
          />
        )}
      </Card>

      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-surface px-5 py-3 shadow-soft">
          <p className="text-sm text-slate-600">
            {selected.size} trabajo{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
            {!canGenerate && (
              <span className="ml-2 text-amber-600">— selecciona trabajos de un único cliente</span>
            )}
          </p>
          <Button onClick={handleGenerateBudget} disabled={!canGenerate || generatingPdf}>
            <IconDownload className="h-4 w-4" />
            {generatingPdf ? "Generando…" : "Generar presupuesto"}
          </Button>
        </div>
      )}
    </div>
  );
}
