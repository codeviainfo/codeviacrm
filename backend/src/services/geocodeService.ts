// Geocoding via the free Nominatim (OpenStreetMap) service. Used for the city
// autocomplete in the scraper. We proxy through the backend to comply with
// Nominatim's usage policy (a descriptive User-Agent is required) and to avoid
// CORS / rate-limit issues from the browser.
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// Nominatim requires an identifying User-Agent referencing the app + contact.
const USER_AGENT = "Codevia-CRM/1.0 (codeviainfo@gmail.com)";

export interface GeocodedCity {
  displayName: string;
  city: string;
  lat: number;
  lon: number;
  // [south, north, west, east]
  boundingBox?: [number, number, number, number];
}

export async function searchCities(query: string): Promise<GeocodedCity[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `${NOMINATIM_SEARCH_URL}?format=jsonv2&addressdetails=1&accept-language=es&limit=6` +
    `&q=${encodeURIComponent(q)}`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "es" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }

  const data = (await response.json()) as any[];

  return data.map((item) => {
    const addr = item.address ?? {};
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county || item.name || "";
    const bb = Array.isArray(item.boundingbox)
      ? (item.boundingbox.map(Number) as [number, number, number, number])
      : undefined;
    return {
      displayName: item.display_name as string,
      city,
      lat: Number(item.lat),
      lon: Number(item.lon),
      boundingBox: bb,
    };
  });
}
