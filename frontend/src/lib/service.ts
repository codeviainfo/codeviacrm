import { ServiceStatus } from "../api/types";

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  pending: "Pendiente",
  completed: "Completado",
  invoiced: "Facturado",
};

export const SERVICE_STATUS_CLS: Record<ServiceStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  invoiced: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function fmtMoney(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
