// Builds a Google Maps URL for a place. Prefers a stored direct link, falls
// back to coordinates, then to a text search by name/address.
export interface MapsTarget {
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
}

export function mapsHref(t: MapsTarget): string {
  if (t.googleMapsUrl) return t.googleMapsUrl;
  if (typeof t.latitude === "number" && typeof t.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${t.latitude},${t.longitude}`;
  }
  const q = [t.name, t.address, t.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// True when we have enough to point at a real location.
export function hasLocation(t: MapsTarget): boolean {
  return Boolean(
    t.googleMapsUrl ||
      (typeof t.latitude === "number" && typeof t.longitude === "number") ||
      t.address
  );
}
