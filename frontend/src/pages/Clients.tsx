import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Client } from "../api/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  cn,
} from "../components/ui";
import {
  IconArchive,
  IconCheck,
  IconClients,
  IconDownload,
  IconEdit,
  IconExternal,
  IconFilter,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "../components/icons";
import { hasLocation, mapsHref } from "../lib/maps";

const emptyForm = {
  name: "",
  businessName: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  zone: "",
  notes: "",
};

const emptyAdvanced = {
  category: "",
  city: "",
  zone: "",
  source: "",
  hasPhone: "",
  hasWebsite: "",
  createdFrom: "",
  createdTo: "",
};

export function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [advanced, setAdvanced] = useState(emptyAdvanced);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const activeAdvancedCount = Object.values(advanced).filter(Boolean).length;

  function buildParams() {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    if (advanced.category) params.category = advanced.category;
    if (advanced.city) params.city = advanced.city;
    if (advanced.zone) params.zone = advanced.zone;
    if (advanced.source) params.source = advanced.source;
    if (advanced.hasPhone) params.hasPhone = advanced.hasPhone;
    if (advanced.hasWebsite) params.hasWebsite = advanced.hasWebsite;
    if (advanced.createdFrom) params.createdFrom = advanced.createdFrom;
    if (advanced.createdTo) params.createdTo = advanced.createdTo;
    return params;
  }

  async function load() {
    const { data } = await api.get<Client[]>("/clients", { params: buildParams() });
    setClients(data);
  }

  useEffect(() => {
    load();
  }, [statusFilter, search, advanced]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/clients", form);
      setForm(emptyForm);
      setShowForm(false);
      load();
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert(client: Client) {
    await api.put(`/clients/${client.id}`, { status: "client" });
    load();
  }

  async function handleArchive(client: Client) {
    await api.put(`/clients/${client.id}`, { status: "archived" });
    load();
  }

  async function handleReactivate(client: Client) {
    await api.put(`/clients/${client.id}`, { status: "lead" });
    load();
  }

  async function handleDelete(client: Client) {
    if (!confirm(`¿Eliminar a ${client.name}?`)) return;
    await api.delete(`/clients/${client.id}`);
    load();
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await api.get("/clients/export", {
        params: buildParams(),
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "clientes.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function clearAdvanced() {
    setAdvanced(emptyAdvanced);
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Gestiona tu cartera de clientes y leads."
        actions={
          <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? (
              "Cancelar"
            ) : (
              <>
                <IconPlus className="h-4 w-4" /> Nuevo cliente
              </>
            )}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 animate-fade-in p-5">
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nombre *">
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Negocio">
                <Input
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                />
              </Field>
              <Field label="Categoría">
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </Field>
              <Field label="Teléfono">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Dirección">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label="Zona">
                <Input
                  value={form.zone}
                  onChange={(e) => setForm({ ...form, zone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notas" className="mt-4">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando…" : "Guardar cliente"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Filter bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative sm:max-w-xs sm:flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o negocio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* Status */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sm:w-48"
          >
            <option value="">Todos los estados</option>
            <option value="lead">Lead</option>
            <option value="prospect">Prospecto</option>
            <option value="client">Cliente</option>
            <option value="inactive">Inactivo</option>
            <option value="archived">Archivado</option>
          </Select>
          {/* Advanced toggle + export share a row on mobile */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAdvanced((v) => !v)}
              className={cn(showAdvanced || activeAdvancedCount > 0 ? "border-brand-400 text-brand-700" : "")}
            >
              <IconFilter className="h-4 w-4" />
              Filtros
              {activeAdvancedCount > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {activeAdvancedCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleExport}
              disabled={exporting}
              title="Exportar lista filtrada a CSV"
            >
              <IconDownload className="h-4 w-4" />
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          </div>
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && (
          <Card className="animate-fade-in p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Categoría">
                <Input
                  placeholder="Ej: peluquería"
                  value={advanced.category}
                  onChange={(e) => setAdvanced({ ...advanced, category: e.target.value })}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  placeholder="Ej: Madrid"
                  value={advanced.city}
                  onChange={(e) => setAdvanced({ ...advanced, city: e.target.value })}
                />
              </Field>
              <Field label="Zona">
                <Input
                  placeholder="Ej: Centro"
                  value={advanced.zone}
                  onChange={(e) => setAdvanced({ ...advanced, zone: e.target.value })}
                />
              </Field>
              <Field label="Fuente">
                <Select
                  value={advanced.source}
                  onChange={(e) => setAdvanced({ ...advanced, source: e.target.value })}
                >
                  <option value="">Todas las fuentes</option>
                  <option value="manual">Alta manual</option>
                  <option value="google_maps">Google Maps</option>
                </Select>
              </Field>
              <Field label="Teléfono">
                <Select
                  value={advanced.hasPhone}
                  onChange={(e) => setAdvanced({ ...advanced, hasPhone: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="true">Con teléfono</option>
                  <option value="false">Sin teléfono</option>
                </Select>
              </Field>
              <Field label="Web">
                <Select
                  value={advanced.hasWebsite}
                  onChange={(e) => setAdvanced({ ...advanced, hasWebsite: e.target.value })}
                >
                  <option value="">Todos</option>
                  <option value="true">Con web</option>
                  <option value="false">Sin web</option>
                </Select>
              </Field>
              <Field label="Creado desde">
                <Input
                  type="date"
                  value={advanced.createdFrom}
                  onChange={(e) => setAdvanced({ ...advanced, createdFrom: e.target.value })}
                />
              </Field>
              <Field label="Creado hasta">
                <Input
                  type="date"
                  value={advanced.createdTo}
                  onChange={(e) => setAdvanced({ ...advanced, createdTo: e.target.value })}
                />
              </Field>
            </div>
            {activeAdvancedCount > 0 && (
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={clearAdvanced}>
                  <IconX className="h-3.5 w-3.5" /> Limpiar filtros avanzados
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <Card className="overflow-hidden">
        {/* Mobile: card list */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {clients.map((c) => (
            <li key={c.id} className="space-y-2.5 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/clients/${c.id}`}
                  className="min-w-0 truncate text-sm font-semibold text-slate-800 hover:text-brand-600"
                >
                  {c.businessName || c.name}
                </Link>
                <StatusBadge status={c.status} />
              </div>
              {(c.category || c.zone) && (
                <p className="truncate text-xs text-slate-400">
                  {[c.category, c.zone].filter(Boolean).join(" · ")}
                </p>
              )}
              {c.phone && (
                <a href={`tel:${c.phone}`} className="block text-sm text-brand-600">
                  {c.phone}
                </a>
              )}
              <ClientRowActions
                client={c}
                onConvert={handleConvert}
                onArchive={handleArchive}
                onReactivate={handleReactivate}
                onDelete={handleDelete}
                onEdit={(cl) => navigate(`/clients/${cl.id}`)}
              />
            </li>
          ))}
        </ul>

        {/* Desktop: table */}
        <div className="scrollbar-slim hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3">Zona</th>
                <th className="px-5 py-3">Teléfono</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/clients/${c.id}`}
                      className="font-medium text-slate-800 hover:text-brand-600"
                    >
                      {c.businessName || c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{c.category || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-500">{c.zone || "—"}</td>
                  <td className="px-5 py-3.5">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="text-slate-500 hover:text-brand-600">
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <ClientRowActions
                      align="end"
                      client={c}
                      onConvert={handleConvert}
                      onArchive={handleArchive}
                      onReactivate={handleReactivate}
                      onDelete={handleDelete}
                      onEdit={(cl) => navigate(`/clients/${cl.id}`)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clients.length === 0 && (
          <EmptyState
            icon={<IconClients />}
            title="No hay clientes"
            description="No se encontraron clientes que coincidan con el filtro."
          />
        )}
      </Card>
    </div>
  );
}

function ClientRowActions({
  client: c,
  align,
  onConvert,
  onArchive,
  onReactivate,
  onDelete,
  onEdit,
}: {
  client: Client;
  align?: "end";
  onConvert: (c: Client) => void;
  onArchive: (c: Client) => void;
  onReactivate: (c: Client) => void;
  onDelete: (c: Client) => void;
  onEdit: (c: Client) => void;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", align === "end" && "justify-end")}>
      {hasLocation(c) && (
        <a
          href={mapsHref(c)}
          target="_blank"
          rel="noreferrer"
          title="Ver en Google Maps"
          aria-label="Ver en Google Maps"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-brand-600 hover:bg-slate-50"
        >
          <IconExternal className="h-4 w-4" />
        </a>
      )}
      {c.status === "lead" && (
        <Button size="sm" variant="secondary" onClick={() => onConvert(c)}>
          <IconCheck className="h-4 w-4" /> Convertir
        </Button>
      )}
      {c.status === "archived" ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onReactivate(c)}
          title="Reactivar como lead"
        >
          <IconCheck className="h-4 w-4" /> Reactivar
        </Button>
      ) : (
        c.status !== "client" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onArchive(c)}
            title="Archivar (rechazó la oferta)"
          >
            <IconArchive className="h-4 w-4" />
          </Button>
        )
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onEdit(c)}
        aria-label="Editar cliente"
        title="Editar cliente"
      >
        <IconEdit className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="danger" onClick={() => onDelete(c)} aria-label="Eliminar">
        <IconTrash className="h-4 w-4" />
      </Button>
    </div>
  );
}
