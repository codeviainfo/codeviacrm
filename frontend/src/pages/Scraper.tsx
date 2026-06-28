import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import {
  Button,
  Card,
  CardHeader,
  cn,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
  Spinner,
} from "../components/ui";
import {
  IconCheck,
  IconExternal,
  IconGlobe,
  IconMap,
  IconPin,
  IconSearch,
  IconStar,
  IconX,
} from "../components/icons";
import { CityAutocomplete, City } from "../components/CityAutocomplete";
import { MapDraw } from "../components/MapDraw";
import { mapsHref } from "../lib/maps";

interface ScrapeJob {
  id: string;
  zone: string;
  category: string;
  status: string;
  source?: string | null;
  resultsCount: number;
  createdAt: string;
  _count?: { candidates: number };
}

type CandidateStatus = "pending" | "accepted" | "rejected";

interface Candidate {
  id: string;
  jobId: string;
  name: string;
  businessName?: string | null;
  category?: string | null;
  phone?: string | null;
  address?: string | null;
  zone?: string | null;
  rating?: number | null;
  website?: string | null;
  hasWebsite: boolean;
  googleMapsUrl?: string | null;
  status: CandidateStatus;
}

export function Scraper() {
  const [mode, setMode] = useState<"text" | "area">("text");
  const [textCity, setTextCity] = useState<City | null>(null);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CandidateStatus>("pending");
  const [webFilter, setWebFilter] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);

  function loadJobs() {
    api.get<ScrapeJob[]>("/scrape/jobs").then((res) => setJobs(res.data));
  }

  async function loadCandidates() {
    const params: Record<string, string> = { status: statusFilter };
    if (selectedJobId) params.jobId = selectedJobId;
    if (webFilter) params.hasWebsite = webFilter;
    if (search) params.search = search;
    const { data } = await api.get<Candidate[]>("/scrape/candidates", { params });
    setCandidates(data);
    setSelected(new Set());
  }

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, statusFilter, webFilter, search]);

  // Shared post-search handling for both the text and area flows.
  function afterSearch(jobId: string, found: number) {
    setStatusFilter("pending");
    setWebFilter("");
    setSearch("");
    setSelectedJobId(jobId);
    setMessage(`Búsqueda completada: ${found} negocios encontrados para revisar.`);
    loadJobs();
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!textCity) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.post<{ jobId: string; found: number }>("/scrape", {
        zone: textCity.city || textCity.displayName,
        category,
      });
      afterSearch(data.jobId, data.found);
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo completar la búsqueda");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pendingIds = useMemo(
    () => candidates.filter((c) => c.status === "pending").map((c) => c.id),
    [candidates]
  );
  const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pendingIds));
  }

  async function runAction(action: "accept" | "reject", ids: string[]) {
    if (ids.length === 0) return;
    setActing(true);
    setMessage(null);
    try {
      const { data } = await api.post(`/scrape/candidates/${action}`, { ids });
      setMessage(
        action === "accept"
          ? `${data.accepted} candidato(s) convertidos en leads.`
          : `${data.rejected} candidato(s) descartados.`
      );
      await loadCandidates();
      loadJobs();
    } finally {
      setActing(false);
    }
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  return (
    <div>
      <PageHeader
        title="Captación vía Google Maps"
        subtitle="Busca negocios, revísalos y decide cuáles pasar a leads."
      />

      {/* Search form — no `overflow-hidden` here so the city autocomplete
          dropdown can extend past the card edge instead of being clipped. */}
      <Card className="mb-6">
        <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-4">
          <div className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <IconMap />
            </span>
            <div>
              <p className="text-sm font-semibold">Nueva búsqueda</p>
              <p className="text-xs text-brand-100">
                Se guardan todos los resultados como candidatos para que los revises.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-100 px-3 pt-3">
          {([
            ["text", "Por texto"],
            ["area", "Por zona en mapa"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
                mode === key
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "text" ? (
          <form onSubmit={handleSearch} className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ciudad * (elige una de la lista)">
                <CityAutocomplete
                  value={textCity}
                  onChange={setTextCity}
                  placeholder="Ej: Valencia"
                />
              </Field>
              <Field label="Categoría de negocio *">
                <Input
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej: peluquerías"
                />
              </Field>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-3">
              {!textCity && (
                <span className="text-xs text-slate-400">Selecciona una ciudad para buscar</span>
              )}
              <Button type="submit" disabled={loading || !textCity || !category}>
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4" /> Buscando…
                  </>
                ) : (
                  <>
                    <IconSearch className="h-4 w-4" /> Buscar negocios
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <AreaScraper
            onError={setError}
            error={error}
            onDone={afterSearch}
          />
        )}
      </Card>

      {message && (
        <div className="mb-6 animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Candidate review */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              title="Revisión de candidatos"
              subtitle={
                selectedJob
                  ? `Búsqueda: ${selectedJob.category} · ${selectedJob.zone}`
                  : "Todas las búsquedas"
              }
              action={
                selectedJobId ? (
                  <button
                    onClick={() => setSelectedJobId(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    <IconX className="h-3.5 w-3.5" /> Quitar filtro
                  </button>
                ) : undefined
              }
            />

            {/* Filters */}
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Buscar candidato…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={webFilter}
                onChange={(e) => setWebFilter(e.target.value as typeof webFilter)}
                className="sm:w-40"
              >
                <option value="">Web: todas</option>
                <option value="true">Con web</option>
                <option value="false">Sin web</option>
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CandidateStatus)}
                className="sm:w-44"
              >
                <option value="pending">Pendientes</option>
                <option value="accepted">Aceptados</option>
                <option value="rejected">Rechazados</option>
              </Select>
            </div>

            {/* Bulk actions */}
            {statusFilter === "pending" && selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/60 px-5 py-3">
                <span className="text-sm font-medium text-brand-800">
                  {selected.size} seleccionado(s)
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => runAction("accept", [...selected])}
                    disabled={acting}
                  >
                    <IconCheck className="h-4 w-4" /> Pasar a leads
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => runAction("reject", [...selected])}
                    disabled={acting}
                  >
                    <IconX className="h-4 w-4" /> Rechazar
                  </Button>
                </div>
              </div>
            )}

            {candidates.length === 0 ? (
              <EmptyState
                icon={<IconSearch />}
                title="No hay candidatos"
                description="Lanza una búsqueda o ajusta los filtros para ver resultados."
              />
            ) : (
              <div className="scrollbar-slim overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {statusFilter === "pending" && (
                        <th className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">Negocio</th>
                      <th className="px-4 py-3">Web</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {candidates.map((c) => (
                      <tr
                        key={c.id}
                        className={cn(
                          "transition-colors hover:bg-slate-50/70",
                          selected.has(c.id) && "bg-brand-50/50"
                        )}
                      >
                        {statusFilter === "pending" && (
                          <td className="px-4 py-3 align-top">
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggle(c.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{c.businessName || c.name}</p>
                          <p className="text-xs text-slate-400">
                            {[c.address, c.phone].filter(Boolean).join(" · ") || "Sin datos"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {c.hasWebsite ? (
                            <a
                              href={c.website || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100"
                            >
                              <IconGlobe className="h-3.5 w-3.5" /> Sí
                            </a>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.rating ? (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                              <IconStar className="h-3.5 w-3.5 text-amber-400" />
                              {c.rating}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={mapsHref(c)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <IconExternal className="h-4 w-4 text-brand-600" /> Maps
                            </a>
                            {c.status === "pending" ? (
                              <>
                                <button
                                  onClick={() => runAction("accept", [c.id])}
                                  disabled={acting}
                                  title="Pasar a lead"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  <IconCheck className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => runAction("reject", [c.id])}
                                  disabled={acting}
                                  title="Rechazar"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <IconX className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <Pill tone={c.status === "accepted" ? "completed" : "cancelled"}>
                                {c.status === "accepted" ? "Lead" : "Rechazado"}
                              </Pill>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Search history */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <CardHeader title="Historial de búsquedas" />
            {jobs.length === 0 ? (
              <EmptyState icon={<IconSearch />} title="Sin búsquedas todavía" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <button
                      onClick={() => setSelectedJobId(j.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50",
                        selectedJobId === j.id && "bg-brand-50/60"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {j.category}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {j.zone} ·{" "}
                          {new Date(j.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {j._count?.candidates ?? j.resultsCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Draw-a-zone capture: pick a city to center the map, draw a polygon, choose a
// category, and fetch every business inside via OpenStreetMap/Overpass.
function AreaScraper({
  onDone,
  onError,
  error,
}: {
  onDone: (jobId: string, found: number) => void;
  onError: (msg: string | null) => void;
  error: string | null;
}) {
  const [city, setCity] = useState<City | null>(null);
  const [category, setCategory] = useState("");
  const [polygon, setPolygon] = useState<[number, number][] | null>(null);
  const [loading, setLoading] = useState(false);

  const center: [number, number] = city ? [city.lat, city.lon] : [40.4168, -3.7038]; // Madrid default

  async function handleSubmit() {
    if (!polygon || polygon.length < 3 || !category) return;
    setLoading(true);
    onError(null);
    try {
      const { data } = await api.post<{ jobId: string; found: number }>("/scrape/area", {
        polygon,
        category,
        cityLabel: city?.city || city?.displayName,
      });
      onDone(data.jobId, data.found);
    } catch (err: any) {
      onError(err.response?.data?.error || "No se pudo completar la búsqueda por zona");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Centrar mapa en ciudad">
          <CityAutocomplete value={city} onChange={setCity} placeholder="Ej: Valencia" />
        </Field>
        <Field label="Categoría de negocio *">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej: peluquerías"
          />
        </Field>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <IconPin className="h-4 w-4 text-brand-500" />
          Usa la herramienta de polígono (arriba a la izquierda del mapa) para dibujar la zona.
        </div>
        <MapDraw center={center} onPolygon={setPolygon} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="text-xs text-slate-400">
          {polygon ? `Zona definida (${polygon.length} puntos)` : "Dibuja una zona en el mapa"}
        </span>
        <Button onClick={handleSubmit} disabled={loading || !polygon || !category}>
          {loading ? (
            <>
              <Spinner className="h-4 w-4" /> Buscando…
            </>
          ) : (
            <>
              <IconSearch className="h-4 w-4" /> Buscar en esta zona
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
