export type ClientStatus = "lead" | "prospect" | "client" | "inactive" | "archived";
export type ClientSource = "manual" | "google_maps";

export interface Client {
  id: string;
  name: string;
  businessName?: string | null;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  zone?: string | null;
  notes?: string | null;
  status: ClientStatus;
  source: ClientSource;
  rating?: number | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  createdAt: string;
  appointments?: Appointment[];
}

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  clientId: string;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  client?: { id: string; name: string; businessName?: string | null };
}

export type ServiceStatus = "pending" | "completed" | "invoiced";

export interface Service {
  id: string;
  clientId: string;
  title: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  status: ServiceStatus;
  date: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    businessName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
  };
}
