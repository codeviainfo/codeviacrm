export interface ScrapedPlace {
  googlePlaceId?: string;
  name: string;
  address?: string;
  phone?: string;
  category?: string;
  rating?: number;
  website?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
}

const PLACES_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export async function searchPlacesByZoneAndCategory(
  zone: string,
  category: string
): Promise<ScrapedPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY no configurada");
  }

  const query = `${category} en ${zone}`;
  const url = `${PLACES_TEXT_SEARCH_URL}?query=${encodeURIComponent(query)}&key=${apiKey}`;

  const response = await fetch(url);
  const data = (await response.json()) as any;

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API error: ${data.status} ${data.error_message ?? ""}`);
  }

  const results = (data.results ?? []) as any[];

  const places = await Promise.all(
    results.slice(0, 20).map(async (place) => {
      const details = await fetchPlaceDetails(place.place_id, apiKey);
      return {
        googlePlaceId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating,
        category,
        phone: details?.phone,
        website: details?.website,
        googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      } as ScrapedPlace;
    })
  );

  return places;
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<{ phone?: string; website?: string } | null> {
  try {
    const url = `${PLACE_DETAILS_URL}?place_id=${placeId}&fields=formatted_phone_number,website&key=${apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as any;
    if (data.status !== "OK") return null;
    return {
      phone: data.result?.formatted_phone_number,
      website: data.result?.website,
    };
  } catch {
    return null;
  }
}
