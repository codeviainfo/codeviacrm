import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Client, Service, ServiceStatus } from "../api/types";
import { SERVICE_STATUS_CLS, SERVICE_STATUS_LABEL, fmtDate, fmtMoney } from "../lib/service";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Pill,
  Select,
  StatusBadge,
  Textarea,
  cn,
} from "../components/ui";
import {
  IconArchive,
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconCalendar,
  IconCheck,
  IconClients,
  IconDownload,
  IconEdit,
  IconExternal,
  IconGlobe,
  IconMail,
  IconMap,
  IconPhone,
  IconPin,
  IconPlus,
  IconTrash,
  IconX,
} from "../components/icons";
import { hasLocation, mapsHref } from "../lib/maps";
import { generateBudgetPdf } from "../lib/budgetPdf";

/* -------------------------------------------------------- ServiceForm */

interface ServiceDraft {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
  status: ServiceStatus;
  date: string;
}

function emptyDraft(): ServiceDraft {
  return {
    title: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    status: "pending",
    date: new Date().toISOString().slice(0, 10),
  };
}

function ServiceForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: ServiceDraft;
  onSave: (d: ServiceDraft) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [d, setD] = useState(initial);
  const f = (k: keyof ServiceDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre del trabajo *" className="sm:col-span-2">
          <Input value={d.title} onChange={f("title")} placeholder="Ej. Diseño web, Automatización…" />
        </Field>
        <Field label="Descripción">
          <Input value={d.description} onChange={f("description")} placeholder="Detalle opcional" />
        </Field>
        <Field label="Fecha">
          <Input type="date" value={d.date} onChange={f("date")} />
        </Field>
        <Field label="Cantidad">
          <Input type="number" min="0.01" step="0.01" value={d.quantity} onChange={f("quantity")} />
        </Field>
        <Field label="Precio unitario (€) *">
          <Input type="number" min="0" step="0.01" value={d.unitPrice} onChange={f("unitPrice")} placeholder="0.00" />
        </Field>
        <Field label="Estado">
          <Select value={d.status} onChange={(e) => setD((p) => ({ ...p, status: e.target.value as ServiceStatus }))}>
            <option value="pending">Pendiente</option>
            <option value="completed">Completado</option>
            <option value="invoiced">Facturado</option>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
          <IconX className="h-4 w-4" /> Cancelar
        </Button>
        <Button size="sm" onClick={() => onSave(d)} disabled={saving || !d.title.trim() || !d.unitPrice}>
          <IconCheck className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- main page */

export function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [draft, setDraft] = useState<Partial<Client>>({});

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [addingService, setAddingService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  async function load() {
    const { data } = await api.get<Client>(`/clients/${id}`);
    setClient(data);
    setNotes(data.notes || "");
  }

  async function loadServices() {
    const { data } = await api.get<Service[]>(`/services?clientId=${id}`);
    setServices(data);
  }

  useEffect(() => {
    load();
    loadServices();
  }, [id]);

  function startEdit() {
    if (!client) return;
    setDraft({
      name: client.name,
      businessName: client.businessName ?? "",
      category: client.category ?? "",
      phone: client.phone ?? "",
      email: client.email ?? "",
      address: client.address ?? "",
      city: client.city ?? "",
      zone: client.zone ?? "",
      website: client.website ?? "",
      status: client.status,
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    try {
      await api.put(`/clients/${id}`, draft);
      await load();
      setEditing(false);
      setDraft({});
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await api.put(`/clients/${id}`, { notes });
      await load();
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleConvert() {
    await api.put(`/clients/${id}`, { status: "client" });
    load();
  }

  async function handleArchive() {
    await api.put(`/clients/${id}`, { status: "archived" });
    load();
  }

  async function handleReactivate() {
    await api.put(`/clients/${id}`, { status: "lead" });
    load();
  }

  async function handleDelete() {
    if (!client || !confirm(`¿Eliminar a ${client.name}?`)) return;
    await api.delete(`/clients/${id}`);
    navigate("/clients");
  }

  /* ---------- service handlers ---------- */

  async function handleAddService(d: ServiceDraft) {
    setSavingService(true);
    try {
      await api.post("/services", {
        clientId: id,
        title: d.title,
        description: d.description || null,
        quantity: parseFloat(d.quantity),
        unitPrice: parseFloat(d.unitPrice),
        status: d.status,
        date: d.date,
      });
      setAddingService(false);
      loadServices();
    } finally {
      setSavingService(false);
    }
  }

  async function handleUpdateService(d: ServiceDraft) {
    if (!editingService) return;
    setSavingService(true);
    try {
      await api.put(`/services/${editingService.id}`, {
        title: d.title,
        description: d.description || null,
        quantity: parseFloat(d.quantity),
        unitPrice: parseFloat(d.unitPrice),
        status: d.status,
        date: d.date,
      });
      setEditingService(null);
      loadServices();
    } finally {
      setSavingService(false);
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!confirm("¿Eliminar este trabajo?")) return;
    await api.delete(`/services/${serviceId}`);
    loadServices();
  }

  async function handleGenerateBudget() {
    if (!client) return;
    setGeneratingPdf(true);
    try {
      await generateBudgetPdf(client, services);
    } finally {
      setGeneratingPdf(false);
    }
  }

  const subtotal = services.reduce((s, r) => s + r.quantity * r.unitPrice, 0);

  if (!client) return <PageLoader />;

  return (
    <div>
      <Link
        to="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <IconArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
            {(client.businessName || client.name).charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {client.businessName || client.name}
              </h1>
              <StatusBadge status={client.status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {client.source === "google_maps" ? "Captado desde Google Maps" : "Alta manual"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              {client.status === "lead" && (
                <Button onClick={handleConvert}>
                  <IconCheck className="h-4 w-4" /> Convertir a cliente
                </Button>
              )}
              {client.status === "archived" ? (
                <Button variant="secondary" onClick={handleReactivate}>
                  <IconCheck className="h-4 w-4" /> Reactivar lead
                </Button>
              ) : (
                client.status !== "client" && (
                  <Button variant="secondary" onClick={handleArchive}>
                    <IconArchive className="h-4 w-4" /> Archivar
                  </Button>
                )
              )}
              <Button variant="secondary" onClick={startEdit}>
                <IconEdit className="h-4 w-4" /> Editar
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <IconTrash className="h-4 w-4" /> Eliminar
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={cancelEdit} disabled={savingEdit}>
                <IconX className="h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                <IconCheck className="h-4 w-4" />
                {savingEdit ? "Guardando…" : "Guardar cambios"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className={cn(editing && "ring-2 ring-brand-500/40 border-brand-400/60")}>
            <CardHeader
              title="Información de contacto"
              subtitle={editing ? "Modo edición — guarda los cambios cuando termines" : undefined}
            />

            {editing ? (
              <>
                <div className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
                  <Field label="Nombre *">
                    <Input
                      required
                      value={draft.name ?? ""}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Negocio">
                    <Input
                      value={(draft.businessName as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                    />
                  </Field>
                  <Field label="Categoría">
                    <Input
                      value={(draft.category as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    />
                  </Field>
                  <Field label="Teléfono">
                    <Input
                      value={(draft.phone as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={(draft.email as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Dirección">
                    <Input
                      value={(draft.address as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    />
                  </Field>
                  <Field label="Ciudad">
                    <Input
                      value={(draft.city as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    />
                  </Field>
                  <Field label="Zona">
                    <Input
                      value={(draft.zone as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, zone: e.target.value })}
                    />
                  </Field>
                  <Field label="Web">
                    <Input
                      type="url"
                      placeholder="https://…"
                      value={(draft.website as string) ?? ""}
                      onChange={(e) => setDraft({ ...draft, website: e.target.value })}
                    />
                  </Field>
                  <Field label="Estado">
                    <Select
                      value={draft.status ?? client.status}
                      onChange={(e) =>
                        setDraft({ ...draft, status: e.target.value as Client["status"] })
                      }
                    >
                      <option value="lead">Lead</option>
                      <option value="prospect">Prospecto</option>
                      <option value="client">Cliente</option>
                      <option value="inactive">Inactivo</option>
                      <option value="archived">Archivado</option>
                    </Select>
                  </Field>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
                  <Button variant="secondary" onClick={cancelEdit} disabled={savingEdit}>
                    <IconX className="h-4 w-4" /> Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={savingEdit}>
                    <IconCheck className="h-4 w-4" />
                    {savingEdit ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </div>
              </>
            ) : (
              <dl className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
                <InfoRow icon={<IconClients />} label="Contacto" value={client.name} />
                <InfoRow icon={<IconMap />} label="Categoría" value={client.category} />
                <InfoRow
                  icon={<IconPhone />}
                  label="Teléfono"
                  value={
                    client.phone ? (
                      <a href={`tel:${client.phone}`} className="text-brand-600 hover:underline">
                        {client.phone}
                      </a>
                    ) : null
                  }
                />
                <InfoRow
                  icon={<IconMail />}
                  label="Email"
                  value={
                    client.email ? (
                      <a href={`mailto:${client.email}`} className="text-brand-600 hover:underline">
                        {client.email}
                      </a>
                    ) : null
                  }
                />
                <InfoRow
                  icon={<IconPin />}
                  label="Dirección"
                  value={
                    <span className="flex flex-col gap-1.5">
                      <span>{[client.address, client.city].filter(Boolean).join(", ") || "—"}</span>
                      {hasLocation(client) && (
                        <a
                          href={mapsHref(client)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-surface px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-slate-50"
                        >
                          <IconExternal className="h-3.5 w-3.5" /> Ver en Google Maps
                        </a>
                      )}
                    </span>
                  }
                />
                <InfoRow icon={<IconPin />} label="Zona" value={client.zone} />
                <InfoRow
                  icon={<IconGlobe />}
                  label="Web"
                  value={
                    client.website ? (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        {client.website}
                      </a>
                    ) : null
                  }
                />
              </dl>
            )}
          </Card>

          {/* ---- Trabajos realizados ---- */}
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <IconBriefcase className="h-4 w-4 text-slate-400" />
                  Trabajos realizados
                </span>
              }
              subtitle={
                services.length > 0
                  ? `${services.length} trabajo${services.length !== 1 ? "s" : ""} · Total: ${fmtMoney(subtotal)}`
                  : "Registra los servicios prestados a este cliente"
              }
              action={
                <div className="flex items-center gap-2">
                  {services.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleGenerateBudget}
                      disabled={generatingPdf}
                    >
                      <IconDownload className="h-4 w-4" />
                      {generatingPdf ? "Generando…" : "Presupuesto"}
                    </Button>
                  )}
                  {!addingService && !editingService && (
                    <Button size="sm" onClick={() => setAddingService(true)}>
                      <IconPlus className="h-4 w-4" /> Añadir
                    </Button>
                  )}
                </div>
              }
            />

            {addingService && (
              <ServiceForm
                initial={emptyDraft()}
                onSave={handleAddService}
                onCancel={() => setAddingService(false)}
                saving={savingService}
              />
            )}

            {services.length === 0 && !addingService ? (
              <EmptyState
                icon={<IconBriefcase />}
                title="Sin trabajos registrados"
                description="Añade los servicios que has realizado para este cliente."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {services.map((svc) =>
                  editingService?.id === svc.id ? (
                    <li key={svc.id}>
                      <ServiceForm
                        initial={{
                          title: svc.title,
                          description: svc.description ?? "",
                          quantity: String(svc.quantity),
                          unitPrice: String(svc.unitPrice),
                          status: svc.status,
                          date: svc.date.slice(0, 10),
                        }}
                        onSave={handleUpdateService}
                        onCancel={() => setEditingService(null)}
                        saving={savingService}
                      />
                    </li>
                  ) : (
                    <li key={svc.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-800">{svc.title}</p>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                              SERVICE_STATUS_CLS[svc.status]
                            )}
                          >
                            {SERVICE_STATUS_LABEL[svc.status]}
                          </span>
                        </div>
                        {svc.description && (
                          <p className="mt-0.5 text-xs text-slate-400">{svc.description}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {fmtDate(svc.date)} · {svc.quantity} × {fmtMoney(svc.unitPrice)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-slate-700">
                          {fmtMoney(svc.quantity * svc.unitPrice)}
                        </span>
                        <button
                          onClick={() => { setAddingService(false); setEditingService(svc); }}
                          className="text-slate-400 hover:text-brand-600"
                          title="Editar"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteService(svc.id)}
                          className="text-slate-400 hover:text-red-500"
                          title="Eliminar"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}

            {services.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <span className="text-xs text-slate-400">
                  IVA (21%): {fmtMoney(subtotal * 0.21)}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Total con IVA: {fmtMoney(subtotal * 1.21)}
                </span>
              </div>
            )}
          </Card>

          {/* ---- Historial de citas ---- */}
          <Card>
            <CardHeader
              title="Historial de citas"
              action={
                <Link
                  to={`/appointments?clientId=${client.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Agendar <IconArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            {!client.appointments || client.appointments.length === 0 ? (
              <EmptyState
                icon={<IconCalendar />}
                title="Sin citas registradas"
                description="Agenda la primera cita para este cliente."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {client.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(a.scheduledAt).toLocaleString("es-ES")}
                      </p>
                    </div>
                    <Pill tone={a.status}>{a.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader title="Notas" />
            <div className="p-5">
              <Textarea
                rows={8}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Añade notas internas sobre este cliente…"
              />
              <Button
                className="mt-3 w-full"
                variant="secondary"
                onClick={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? "Guardando…" : "Guardar notas"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-slate-400">{label}</dt>
        <dd className="truncate text-sm text-slate-800">{value || "—"}</dd>
      </div>
    </div>
  );
}
