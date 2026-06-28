import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Input } from "./ui";
import { IconPin, IconSearch } from "./icons";

export interface City {
  displayName: string;
  city: string;
  lat: number;
  lon: number;
  boundingBox?: [number, number, number, number];
}

interface Props {
  value: City | null;
  onChange: (city: City | null) => void;
  placeholder?: string;
  required?: boolean;
}

// City autocomplete backed by Nominatim (via /geocode/cities). The parent only
// gets a value once the user picks a suggestion — typing free text clears the
// selection, so callers can require a real city before searching.
export function CityAutocomplete({ value, onChange, placeholder, required }: Props) {
  const [text, setText] = useState(value?.displayName ?? "");
  const [options, setOptions] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the input in sync when the parent clears/sets the value externally.
  useEffect(() => {
    if (value) setText(value.displayName);
  }, [value]);

  // Debounced lookup.
  useEffect(() => {
    if (value && text === value.displayName) return; // selection unchanged
    const q = text.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<City[]>("/geocode/cities", { params: { q } });
        setOptions(data);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(city: City) {
    onChange(city);
    setText(city.displayName);
    setOptions([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
      <Input
        required={required}
        value={text}
        placeholder={placeholder ?? "Escribe una ciudad…"}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null); // typing invalidates the prior selection
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        className="pl-10"
        autoComplete="off"
      />
      {value && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
          <IconPin className="h-4 w-4" />
        </span>
      )}
      {open && (loading || options.length > 0) && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-surface py-1 shadow-soft">
          {loading && options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">Buscando…</li>
          ) : (
            options.map((o, i) => (
              <li key={`${o.lat}-${o.lon}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(o)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{o.city}</span>
                    <span className="block truncate text-xs text-slate-400">{o.displayName}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
