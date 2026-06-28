import type { ScrapedPlace } from "./googlePlacesService";

// Free POI source: OpenStreetMap via the Overpass API. Overpass supports
// arbitrary polygon queries natively (the `poly:` filter), so the user can draw
// a zone and we fetch every matching business inside it. OSM has no rating or
// review-count data — only category, website and phone (from tags).
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "Codevia-CRM/1.0 (codeviainfo@gmail.com)";

type TagFilter = [key: string, value?: string];

// Maps free-text Spanish business categories to OSM tag filters. Matching is
// approximate; uncommon categories fall back to a name-based search.
const CATEGORY_MAP: Record<string, TagFilter[]> = {
  peluqueria: [["shop", "hairdresser"]],
  barberia: [["shop", "hairdresser"]],
  restaurante: [["amenity", "restaurant"]],
  bar: [["amenity", "bar"], ["amenity", "pub"]],
  cafeteria: [["amenity", "cafe"]],
  cafe: [["amenity", "cafe"]],
  panaderia: [["shop", "bakery"]],
  supermercado: [["shop", "supermarket"]],
  tienda: [["shop"]],
  gimnasio: [["leisure", "fitness_centre"], ["leisure", "sports_centre"]],
  dentista: [["amenity", "dentist"]],
  clinica: [["amenity", "clinic"]],
  medico: [["amenity", "doctors"]],
  farmacia: [["amenity", "pharmacy"]],
  veterinario: [["amenity", "veterinary"]],
  abogado: [["office", "lawyer"]],
  gestoria: [["office", "accountant"], ["office", "tax_advisor"]],
  inmobiliaria: [["office", "estate_agent"]],
  hotel: [["tourism", "hotel"]],
  taller: [["shop", "car_repair"]],
  ferreteria: [["shop", "hardware"], ["shop", "doityourself"]],
  floristeria: [["shop", "florist"]],
  optica: [["shop", "optician"]],
  ropa: [["shop", "clothes"]],
  zapateria: [["shop", "shoes"]],
  joyeria: [["shop", "jewelry"]],
  estetica: [["shop", "beauty"], ["leisure", "spa"]],
  belleza: [["shop", "beauty"]],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function buildFilters(category: string): { filters: TagFilter[]; nameTerm: string } {
  const norm = normalize(category);
  // Find a mapping whose key is contained in the searched text (e.g. "peluquerías baratas").
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (norm.includes(key)) {
      return { filters: CATEGORY_MAP[key], nameTerm: category };
    }
  }
  // No mapping: rely purely on a name-based search.
  return { filters: [], nameTerm: category };
}

function clause(element: "node" | "way", filter: TagFilter, polygon: string): string {
  const [key, value] = filter;
  const tag = value ? `["${key}"="${value}"]` : `["${key}"]`;
  return `${element}${tag}(poly:"${polygon}");`;
}

export async function searchBusinessesInPolygon(
  polygon: [number, number][],
  category: string
): Promise<ScrapedPlace[]> {
  if (polygon.length < 3) return [];

  // Overpass poly filter: space-separated "lat lon lat lon ..." pairs.
  const polyStr = polygon.map(([lat, lon]) => `${lat} ${lon}`).join(" ");
  const { filters, nameTerm } = buildFilters(category);

  const body: string[] = [];
  for (const f of filters) {
    body.push(clause("node", f, polyStr));
    body.push(clause("way", f, polyStr));
  }
  // Name-based fallback (always added — broadens recall, esp. for unmapped categories).
  const safeName = nameTerm.replace(/["\\]/g, "");
  body.push(`node["name"~"${safeName}",i](poly:"${polyStr}");`);
  body.push(`way["name"~"${safeName}",i](poly:"${polyStr}");`);

  const query = `[out:json][timeout:30];(${body.join("")});out center tags 300;`;

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error(`Overpass error: ${response.status}`);
  }

  const data = (await response.json()) as { elements?: any[] };
  const elements = data.elements ?? [];

  const places: ScrapedPlace[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name as string | undefined;
    if (!name) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;

    const phone = tags.phone || tags["contact:phone"] || tags["contact:mobile"] || undefined;
    const website = tags.website || tags["contact:website"] || tags.url || undefined;
    const address = [
      [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" "),
      tags["addr:city"],
    ]
      .filter(Boolean)
      .join(", ");

    // Point the Maps link at the business by name (+ address) rather than raw
    // coordinates — OSM gives no place_id, and a "lat,lon" query just drops a pin
    // on the map showing the coordinates instead of the actual business.
    const mapsQuery = [name, address].filter(Boolean).join(" ");

    places.push({
      name,
      category,
      phone,
      address: address || undefined,
      website,
      latitude: typeof lat === "number" ? lat : undefined,
      longitude: typeof lon === "number" ? lon : undefined,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        mapsQuery
      )}`,
    });
  }

  return places;
}
