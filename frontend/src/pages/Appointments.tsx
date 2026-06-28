import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Appointment, Client } from "../api/types";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  Select,
  Textarea,
  cn,
} from "../components/ui";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "../components/icons";

const statusLabels: Record<Appointment["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const STATUS_CHIP: Record<Appointment["status"], string> = {
  pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-brand-50 text-brand-700 border border-brand-200",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60",
};

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_CHIPS = 3;

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  // Convert JS day (0=Sun) to Mon-first (0=Mon, 6=Sun)
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Pad with prev-month days
  for (let i = startDow - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }

  // Current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Pad with next-month days to complete the last row
  const remaining = days.length % 7;
  if (remaining > 0) {
    for (let i = 1; i <= 7 - remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
  }

  return days;
}

export function Appointments() {
  const [searchParams] = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(Boolean(searchParams.get("clientId")));
  const [form, setForm] = useState({
    clientId: searchParams.get("clientId") || "",
    title: "",
    description: "",
    scheduledAt: "",
    durationMinutes: 30,
  });

  // View toggle
  const [view, setView] = useState<"list" | "calendar">("list");

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  // List filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const today = useMemo(() => new Date(), []);
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  async function load() {
    const params: Record<string, string> = {};
    if (view === "list") {
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.from = new Date(dateFrom).toISOString();
      if (dateTo) params.to = new Date(dateTo + "T23:59:59").toISOString();
    } else {
      const lastDay = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
      params.from = calMonth.toISOString();
      params.to = new Date(
        lastDay.getFullYear(),
        lastDay.getMonth(),
        lastDay.getDate(),
        23, 59, 59
      ).toISOString();
    }
    const { data } = await api.get<Appointment[]>("/appointments", { params });
    setAppointments(data);
  }

  useEffect(() => {
    api.get<Client[]>("/clients").then((res) => setClients(res.data));
  }, []);

  useEffect(() => {
    load();
  }, [view, calMonth, statusFilter, dateFrom, dateTo]);

  // List: client-side text filter
  const filtered = useMemo(() => {
    if (!search) return appointments;
    const q = search.toLowerCase();
    return appointments.filter((a) => {
      const clientName = (a.client?.businessName || a.client?.name || "").toLowerCase();
      return a.title.toLowerCase().includes(q) || clientName.includes(q);
    });
  }, [appointments, search]);

  const hasFilters = search || statusFilter || dateFrom || dateTo;

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  // Calendar computed
  const calDays = useMemo(
    () => getCalendarDays(calMonth.getFullYear(), calMonth.getMonth()),
    [calMonth]
  );

  const appointmentsByDay = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      const key = new Date(a.scheduledAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointments]);

  function prevMonth() {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
    setSelectedAppt(null);
  }
  function nextMonth() {
    setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));
    setSelectedAppt(null);
  }
  function goToday() {
    setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedAppt(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/appointments", {
      ...form,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
    });
    setForm({ clientId: "", title: "", description: "", scheduledAt: "", durationMinutes: 30 });
    setShowForm(false);
    load();
  }

  async function updateStatus(appointment: Appointment, status: Appointment["status"]) {
    await api.put(`/appointments/${appointment.id}`, { status });
    setSelectedAppt((prev) => (prev?.id === appointment.id ? { ...prev, status } : prev));
    load();
  }

  async function handleDelete(appointment: Appointment) {
    if (!confirm("¿Eliminar esta cita?")) return;
    await api.delete(`/appointments/${appointment.id}`);
    setSelectedAppt((prev) => (prev?.id === appointment.id ? null : prev));
    load();
  }

  return (
    <div>
      <PageHeader
        title="Citas"
        subtitle="Agenda y haz seguimiento de tus reuniones."
        actions={
          <Button
            onClick={() => setShowForm((v) => !v)}
            variant={showForm ? "secondary" : "primary"}
          >
            {showForm ? (
              "Cancelar"
            ) : (
              <>
                <IconPlus className="h-4 w-4" /> Nueva cita
              </>
            )}
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6 animate-fade-in p-5">
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente *">
                <Select
                  required
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName || c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Título *">
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Fecha y hora *">
                <Input
                  required
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </Field>
              <Field label="Duración (min)">
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({ ...form, durationMinutes: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <Field label="Descripción" className="mt-4">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <div className="mt-4 flex justify-end">
              <Button type="submit">Guardar cita</Button>
            </div>
          </form>
        </Card>
      )}

      {/* View toggle */}
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          onClick={() => setView("list")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            view === "list"
              ? "bg-surface text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Lista
        </button>
        <button
          onClick={() => setView("calendar")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            view === "calendar"
              ? "bg-surface text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <IconCalendar className="h-3.5 w-3.5" /> Calendario
        </button>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por título o cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sm:w-44"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmada</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </Select>
            <Field label="Desde" className="!block">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </Field>
            <Field label="Hasta" className="!block">
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </Field>
            {hasFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <IconX className="h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
          </div>

          <Card className="overflow-hidden">
            <div className="scrollbar-slim overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Título</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                        {new Date(a.scheduledAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800">{a.title}</td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {a.client?.businessName || a.client?.name}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Pill tone={a.status}>{statusLabels[a.status]}</Pill>
                          <Select
                            value={a.status}
                            onChange={(e) =>
                              updateStatus(a, e.target.value as Appointment["status"])
                            }
                            className="h-8 w-36 text-xs"
                          >
                            <option value="pending">Pendiente</option>
                            <option value="confirmed">Confirmada</option>
                            <option value="completed">Completada</option>
                            <option value="cancelled">Cancelada</option>
                          </Select>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(a)}
                            aria-label="Eliminar"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <EmptyState
                icon={<IconCalendar />}
                title="No hay citas"
                description={
                  hasFilters
                    ? "Ninguna cita coincide con los filtros aplicados."
                    : "Crea una nueva cita para empezar a organizar tu agenda."
                }
              />
            )}
          </Card>
        </>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <>
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Mes anterior"
              >
                <IconArrowLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextMonth}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Mes siguiente"
              >
                <IconArrowRight className="h-4 w-4" />
              </button>
              <h2 className="ml-1 text-base font-semibold capitalize text-slate-800">
                {calMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </h2>
            </div>
            <button
              onClick={goToday}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hoy
            </button>
          </div>

          {/* Calendar grid */}
          <Card className="overflow-hidden">
            {/* Day name headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
              {DAY_HEADERS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calDays.map((day, idx) => {
                const key = day.date.toLocaleDateString("en-CA");
                const dayAppts = appointmentsByDay[key] ?? [];
                const todayCell = isToday(day.date);
                const visible = dayAppts.slice(0, MAX_CHIPS);
                const overflow = dayAppts.length - MAX_CHIPS;
                const isLastCol = idx % 7 === 6;
                const isLastRow = idx >= calDays.length - 7;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "min-h-[96px] border-b border-r border-slate-100 p-1.5",
                      !day.isCurrentMonth && "bg-slate-50/50",
                      isLastCol && "border-r-0",
                      isLastRow && "border-b-0"
                    )}
                  >
                    {/* Day number */}
                    <div
                      className={cn(
                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        todayCell
                          ? "bg-brand-600 text-white"
                          : day.isCurrentMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                      )}
                    >
                      {day.date.getDate()}
                    </div>

                    {/* Appointment chips */}
                    <div className="space-y-0.5">
                      {visible.map((a) => (
                        <button
                          key={a.id}
                          onClick={() =>
                            setSelectedAppt(selectedAppt?.id === a.id ? null : a)
                          }
                          className={cn(
                            "w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-all",
                            STATUS_CHIP[a.status],
                            selectedAppt?.id === a.id && "ring-1 ring-brand-400"
                          )}
                          title={`${a.title} · ${a.client?.businessName || a.client?.name}`}
                        >
                          {a.title}
                        </button>
                      ))}
                      {overflow > 0 && (
                        <p className="px-1 text-[11px] text-slate-400">+{overflow} más</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Selected appointment detail panel */}
          {selectedAppt && (
            <Card className="mt-4 animate-fade-in">
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{selectedAppt.title}</h3>
                    <Pill tone={selectedAppt.status}>{statusLabels[selectedAppt.status]}</Pill>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {selectedAppt.client?.businessName || selectedAppt.client?.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {new Date(selectedAppt.scheduledAt).toLocaleString("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {selectedAppt.durationMinutes
                      ? ` · ${selectedAppt.durationMinutes} min`
                      : ""}
                  </p>
                  {selectedAppt.description && (
                    <p className="mt-2 text-sm text-slate-500">{selectedAppt.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={selectedAppt.status}
                    onChange={(e) =>
                      updateStatus(selectedAppt, e.target.value as Appointment["status"])
                    }
                    className="h-8 w-36 text-xs"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                  </Select>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(selectedAppt)}
                    aria-label="Eliminar cita"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedAppt(null)}
                    aria-label="Cerrar"
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
