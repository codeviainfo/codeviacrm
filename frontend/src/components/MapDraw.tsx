import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

// Fix Leaflet's default marker icon paths when bundled (Vite). leaflet-draw uses
// these for vertex/edit handles.
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface Props {
  center: [number, number];
  zoom?: number;
  onPolygon: (coords: [number, number][] | null) => void;
}

// Interactive OSM map that lets the user draw a single polygon. Emits the
// polygon as [lat, lon][] (or null when cleared).
export function MapDraw({ center, zoom = 14, onPolygon }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnRef = useRef<L.FeatureGroup | null>(null);
  const onPolygonRef = useRef(onPolygon);
  onPolygonRef.current = onPolygon;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawn },
    });
    map.addControl(drawControl);

    function emit() {
      const layers = drawn.getLayers();
      if (layers.length === 0) {
        onPolygonRef.current(null);
        return;
      }
      const poly = layers[layers.length - 1] as L.Polygon;
      const latlngs = poly.getLatLngs()[0] as L.LatLng[];
      onPolygonRef.current(latlngs.map((p) => [p.lat, p.lng]));
    }

    map.on(L.Draw.Event.CREATED, (e: any) => {
      drawn.clearLayers(); // keep a single polygon
      drawn.addLayer(e.layer);
      emit();
    });
    map.on(L.Draw.Event.EDITED, emit);
    map.on(L.Draw.Event.DELETED, emit);

    mapRef.current = map;
    drawnRef.current = drawn;

    // The container may mount before its final size is known.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      drawnRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when the selected city changes.
  useEffect(() => {
    mapRef.current?.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  return <div ref={containerRef} className="h-64 w-full rounded-xl sm:h-80" />;
}
