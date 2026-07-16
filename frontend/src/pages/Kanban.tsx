import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Client, ClientStatus } from "../api/types";
import { PageHeader, StatusBadge, cn } from "../components/ui";
import { IconExternal, IconPhone } from "../components/icons";
import { hasLocation, mapsHref } from "../lib/maps";

function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[draggable="true"]')) return;
    dragging.current = true;
    startX.current = e.pageX - (ref.current?.offsetLeft ?? 0);
    scrollLeft.current = ref.current?.scrollLeft ?? 0;
    if (ref.current) ref.current.style.cursor = "grabbing";
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    ref.current.scrollLeft = scrollLeft.current - (x - startX.current) * 1.2;
  }

  function onMouseUp() {
    dragging.current = false;
    if (ref.current) ref.current.style.cursor = "grab";
  }

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp };
}

interface Column {
  status: ClientStatus;
  label: string;
  accent: string;
  headerCls: string;
}

const COLUMNS: Column[] = [
  { status: "lead",     label: "Leads",      accent: "border-amber-400",   headerCls: "text-amber-600" },
  { status: "prospect", label: "Prospectos", accent: "border-brand-400",   headerCls: "text-brand-600" },
  { status: "client",   label: "Clientes",   accent: "border-emerald-400", headerCls: "text-emerald-600" },
  { status: "archived", label: "Archivados", accent: "border-purple-300",  headerCls: "text-purple-500" },
  { status: "inactive", label: "Inactivos",  accent: "border-slate-300",   headerCls: "text-slate-400" },
];

const EDGE_THRESHOLD = 120; // px from edge to trigger auto-scroll
const SCROLL_SPEED = 12;    // px per animation frame

export function Kanban() {
  const [clients, setClients] = useState<Client[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ClientStatus | null>(null);
  const dragStatus = useRef<ClientStatus | null>(null);
  const scroll = useDragScroll();

  // Auto-scroll state during card drag
  const autoScrollDir = useRef<number>(0);
  const autoScrollFrame = useRef<number | null>(null);

  function stopAutoScroll() {
    autoScrollDir.current = 0;
    if (autoScrollFrame.current !== null) {
      cancelAnimationFrame(autoScrollFrame.current);
      autoScrollFrame.current = null;
    }
  }

  function startAutoScroll(dir: number) {
    if (dir === autoScrollDir.current) return;
    stopAutoScroll();
    if (dir === 0) return;
    autoScrollDir.current = dir;
    const container = scroll.ref.current;
    function tick() {
      if (!container || autoScrollDir.current === 0) return;
      container.scrollLeft += autoScrollDir.current * SCROLL_SPEED;
      autoScrollFrame.current = requestAnimationFrame(tick);
    }
    autoScrollFrame.current = requestAnimationFrame(tick);
  }

  // Called on dragover of the outer scrollable container (bubbles up from columns)
  function handleContainerDragOver(e: React.DragEvent) {
    const container = scroll.ref.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (e.clientX < rect.left + EDGE_THRESHOLD) startAutoScroll(-1);
    else if (e.clientX > rect.right - EDGE_THRESHOLD) startAutoScroll(1);
    else startAutoScroll(0);
  }

  async function load() {
    const { data } = await api.get<Client[]>("/clients");
    setClients(data);
  }

  useEffect(() => { load(); }, []);

  function handleDragStart(client: Client) {
    setDraggingId(client.id);
    dragStatus.current = client.status;
  }

  function handleDragEnd() {
    stopAutoScroll();
    setDraggingId(null);
    setOverStatus(null);
    dragStatus.current = null;
  }

  async function handleDrop(targetStatus: ClientStatus) {
    stopAutoScroll();
    if (!draggingId || dragStatus.current === targetStatus) {
      handleDragEnd();
      return;
    }
    // Optimistic update
    setClients((prev) =>
      prev.map((c) => (c.id === draggingId ? { ...c, status: targetStatus } : c))
    );
    handleDragEnd();
    try {
      await api.put(`/clients/${draggingId}`, { status: targetStatus });
    } catch {
      load(); // rollback on error
    }
  }

  // Touch-friendly fallback: move a card via the select shown on small screens,
  // where HTML5 drag & drop is unavailable.
  async function moveTo(client: Client, targetStatus: ClientStatus) {
    if (client.status === targetStatus) return;
    setClients((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, status: targetStatus } : c))
    );
    try {
      await api.put(`/clients/${client.id}`, { status: targetStatus });
    } catch {
      load(); // rollback on error
    }
  }

  const byStatus = (status: ClientStatus) => clients.filter((c) => c.status === status);

  return (
    <div>
      <PageHeader
        title="Seguimiento de clientes"
        subtitle={
          <>
            <span className="hidden lg:inline">
              Arrastra las tarjetas entre columnas para cambiar su estado. Al acercarte al borde
              el tablero se desplaza solo.
            </span>
            <span className="lg:hidden">
              Usa el selector de cada tarjeta para cambiar su estado. Desliza para ver más
              columnas.
            </span>
          </>
        }
      />

      <div
        ref={scroll.ref}
        className="flex gap-4 overflow-x-auto pb-4 cursor-grab select-none"
        onMouseDown={scroll.onMouseDown}
        onMouseMove={scroll.onMouseMove}
        onMouseUp={scroll.onMouseUp}
        onMouseLeave={scroll.onMouseLeave}
        onDragOver={handleContainerDragOver}
        onDragLeave={stopAutoScroll}
      >
        {COLUMNS.map((col) => {
          const cards = byStatus(col.status);
          const isOver = overStatus === col.status;

          return (
            <div
              key={col.status}
              className="flex w-[80vw] max-w-[18rem] shrink-0 flex-col sm:w-72 sm:max-w-none"
              onDragOver={(e) => { e.preventDefault(); setOverStatus(col.status); }}
              onDragLeave={() => setOverStatus(null)}
              onDrop={() => handleDrop(col.status)}
            >
              {/* Column header */}
              <div className={cn("mb-3 flex items-center justify-between rounded-xl border-l-4 bg-surface px-4 py-2.5 shadow-card", col.accent)}>
                <span className={cn("text-sm font-semibold", col.headerCls)}>{col.label}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                  {cards.length}
                </span>
              </div>

              {/* Drop zone */}
              <div
                className={cn(
                  "flex flex-1 flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition-colors min-h-[120px]",
                  isOver ? "border-brand-400 bg-brand-50/30" : "border-transparent"
                )}
              >
                {cards.map((client) => (
                  <KanbanCard
                    key={client.id}
                    client={client}
                    isDragging={draggingId === client.id}
                    onDragStart={() => handleDragStart(client)}
                    onDragEnd={handleDragEnd}
                    onMove={(status) => moveTo(client, status)}
                  />
                ))}
                {cards.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg py-6 text-xs text-slate-400">
                    Sin registros
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  client,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  client: Client;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: ClientStatus) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab rounded-xl border border-slate-200 bg-surface p-3 shadow-card transition-all active:cursor-grabbing",
        isDragging ? "opacity-40 scale-95" : "hover:shadow-soft hover:-translate-y-0.5"
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          to={`/clients/${client.id}`}
          className="truncate text-sm font-semibold text-slate-800 hover:text-brand-600"
          onClick={(e) => e.stopPropagation()}
        >
          {client.businessName || client.name}
        </Link>
        <StatusBadge status={client.status} />
      </div>

      {client.category && (
        <p className="mb-1 truncate text-xs text-slate-400">{client.category}</p>
      )}
      {client.zone && (
        <p className="truncate text-xs text-slate-400">{client.zone}</p>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        {client.phone && (
          <a
            href={`tel:${client.phone}`}
            className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <IconPhone className="h-3 w-3" />
            {client.phone}
          </a>
        )}
        {hasLocation(client) && (
          <a
            href={mapsHref(client)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-brand-600"
            onClick={(e) => e.stopPropagation()}
          >
            <IconExternal className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Touch fallback: change status without drag & drop (drag is mouse-only) */}
      <select
        value={client.status}
        onChange={(e) => onMove(e.target.value as ClientStatus)}
        onClick={(e) => e.stopPropagation()}
        className="mt-2.5 h-8 w-full rounded-lg border border-slate-200 bg-surface px-2 text-xs text-slate-600 focus:border-brand-400 focus:outline-none lg:hidden"
        aria-label="Cambiar estado"
      >
        {COLUMNS.map((col) => (
          <option key={col.status} value={col.status}>
            {col.label}
          </option>
        ))}
      </select>
    </div>
  );
}
