"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResponse, LatLon, SourceRef, ToolResult, UrbanismData, FloodData, WeatherData, GeocodeData } from "@/types/analysis";

import { MapView } from "@/components/map/map-view";
import { AddressSearch } from "@/components/search/address-search";
import { ReportPanel } from "@/components/report/report-panel";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { toast } from "sonner";

import {
  createSavedLocation,
  loadSavedLocations,
  removeLocation,
  saveSavedLocations,
  updateLocationNote,
  type SavedLocation,
} from "@/lib/storage/savedLocations";

import { SavedLocationsDialog } from "@/components/saved/saved-locations-dialog";
import { PrintReport } from "@/components/report/print-report";
import { MapLayersPanel } from "@/components/map/map-layers-panel";
import { WeatherMiniCard } from "@/components/map/weather-mini-card";

// -----------------------------
// Normalización defensiva
// -----------------------------
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function normalizeSources(v: unknown): SourceRef[] {
  if (Array.isArray(v)) return v as SourceRef[];

  // Si viene como objeto (ej. { nominatim: "url", overpass: "url" })
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, any>).map(([name, val]) => {
      if (typeof val === "string") return { name, url: val };
      return {
        name: val?.name ?? name,
        url: val?.url ?? String(val ?? ""),
        note: val?.note,
      };
    });
  }

  return [];
}

function ensureToolResult<T>(v: any, fallback: ToolResult<T>): ToolResult<T> {
  if (v && typeof v === "object" && typeof v.ok === "boolean") return v as ToolResult<T>;
  return fallback;
}

function normalizeAnalysisResponse(raw: any): AnalysisResponse {
  const coords =
    raw?.coords && typeof raw.coords === "object"
      ? raw.coords
      : { lat: raw?.lat ?? 0, lon: raw?.lon ?? 0, label: raw?.label };

  const sources = normalizeSources(raw?.sources);
  const limitations = asArray<string>(raw?.limitations);

  // Intentamos leer data.*; si no existe, lo construimos.
  const rawData = raw?.data && typeof raw.data === "object" ? raw.data : {};

  const urban = ensureToolResult<UrbanismData>(rawData?.urban ?? raw?.urban, {
    ok: false,
    error: "No llegó 'urban' desde /api/analyze",
    limitations: ["No hay datos de infraestructura (urban) en la respuesta."],
  });

  const flood = ensureToolResult<FloodData>(rawData?.flood ?? raw?.flood, {
    ok: false,
    error: "No llegó 'flood' desde /api/analyze",
    limitations: ["No hay datos de inundación (flood) en la respuesta."],
    data: {
      wms_url: "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100",
      note: "Sin datos de Q100.",
    },
  });

  const geocode =
    rawData?.geocode
      ? ensureToolResult<GeocodeData>(rawData.geocode, { ok: false })
      : undefined;

  const weather =
    rawData?.weather
      ? ensureToolResult<WeatherData>(rawData.weather, { ok: false })
      : undefined;

  return {
    coords,
    data: {
      geocode,
      urban,
      flood,
      weather,
    },
    report: typeof raw?.report === "string" ? raw.report : "",
    sources,
    limitations,
  };
}

export default function Page() {
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<LatLon | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Saved locations dialog
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  // Map layers panel (base + weather + flood)
  const [layersOpen, setLayersOpen] = useState(false);
  const [baseMap, setBaseMap] = useState<"streets" | "satellite">("streets");
  const [weather, setWeather] = useState<
    "none" | "temp" | "precipitation" | "clouds" | "wind"
  >("none");
  const [weatherOpacity, setWeatherOpacity] = useState(0.8);
  const [floodOn, setFloodOn] = useState(false);

  // Satélite por Mapbox token
  const hasMapboxToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    const initial = loadSavedLocations();
    setSavedLocations(initial);
  }, []);

  useEffect(() => {
    saveSavedLocations(savedLocations);
  }, [savedLocations]);

  const coordLabel = useMemo(() => {
    if (!coords) return "Sin selección";
    return `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
  }, [coords]);

  async function analyze(payload: { address?: string; lat?: number; lon?: number }) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.json().catch(() => ({}));
      const normalized = normalizeAnalysisResponse(raw);

      if (!res.ok) throw new Error(raw?.error || "Error en el análisis");

      setResult(normalized);

      if (typeof normalized.coords?.lat === "number" && typeof normalized.coords?.lon === "number") {
        setCoords({ lat: normalized.coords.lat, lon: normalized.coords.lon });
      }

      toast.success("Análisis completado");
    } catch (e: any) {
      setResult(null);
      setError(e?.message || "Error inesperado");
      toast.error("No se pudo completar el análisis");
    } finally {
      setLoading(false);
    }
  }

  function handleSaveCurrent() {
    if (!result) {
      toast.error("No hay análisis para guardar");
      return;
    }

    const lat = result.coords?.lat;
    const lon = result.coords?.lon;

    if (typeof lat !== "number" || typeof lon !== "number") {
      toast.error("El análisis no tiene coordenadas válidas");
      return;
    }

    const title =
      result.coords.label?.trim() ||
      address.trim() ||
      `Ubicación ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    const item = createSavedLocation({
      title,
      coords: { lat, lon },
      snapshot: result,
      note: "",
    });

    setSavedLocations((prev) => [item, ...prev]);
    toast.success("Ubicación guardada");
  }

  function handleLoadSaved(item: SavedLocation) {
    setCoords(item.coords);
    setResult(item.snapshot);
    setError(null);
    setAddress(item.title);
    toast.success("Ubicación cargada");
  }

  function handleDeleteSaved(id: string) {
    setSavedLocations((prev) => removeLocation(prev, id));
    toast.message("Ubicación eliminada");
  }

  function handleUpdateNote(id: string, note: string) {
    setSavedLocations((prev) => updateLocationNote(prev, id, note));
    toast.message("Nota actualizada");
  }

  const weatherLayer =
    weather === "none"
      ? null
      : weather === "temp"
        ? "temp_new"
        : weather === "precipitation"
          ? "precipitation_new"
          : weather === "clouds"
            ? "clouds_new"
            : "wind_new";

  return (
    <main className="h-dvh overflow-hidden">
      <div className="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[460px_1fr] md:p-6 print:hidden">
        {/* Columna izquierda */}
        <div className="flex min-h-0 flex-col gap-4">
          {/* Panel superior */}
          <div className="shrink-0 rounded-xl border p-4">
            <div className="mb-3 text-lg font-semibold">MAP-IA</div>

            <AddressSearch
              address={address}
              onAddressChange={setAddress}
              onAnalyzeByAddress={() => analyze({ address })}
              disabled={loading}
            />

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="text-sm">
                <div className="text-muted-foreground">Coordenadas seleccionadas</div>
                <div className="font-medium">{coordLabel}</div>
              </div>
              <Badge variant={coords ? "default" : "secondary"}>
                {coords ? "OK" : "Sin punto"}
              </Badge>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="w-full"
                disabled={!coords || loading}
                onClick={() => coords && analyze({ lat: coords.lat, lon: coords.lon })}
              >
                Analizar punto del mapa
              </Button>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setAddress("");
                  setCoords(null);
                  setResult(null);
                  setError(null);
                  toast.message("Limpio");
                }}
              >
                Limpiar
              </Button>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              La IA se basa en datos reales. Si una fuente no responde, se indicará como
              limitación. Úsala como apoyo y valida siempre con fuentes oficiales.
            </div>

            <div className="mt-3">
              <Button className="w-full" disabled={!result || loading} onClick={handleSaveCurrent}>
                Guardar ubicación
              </Button>
            </div>

            <div className="mt-2">
              <Button className="w-full" variant="outline" onClick={() => setSavedOpen(true)}>
                Ubicaciones guardadas
              </Button>
            </div>

            <div className="mt-2">
              <Button
                className="w-full"
                variant="outline"
                disabled={!result}
                onClick={() => {
                  if (!result) {
                    toast.error("No hay informe para exportar");
                    return;
                  }
                  window.print();
                }}
              >
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Resultados (scroll interno) */}
          <div className="min-h-0 flex-1">
            <ReportPanel loading={loading} result={result} error={error} />
          </div>
        </div>

        {/* Columna derecha */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Coordenadas arriba a la derecha */}
          <div className="ml-auto flex min-h-0 flex-col items-end justify-between gap-2">
            <span className="font-medium text-foreground">{coordLabel}</span>
          </div>

          <MapView
            value={coords}
            onPick={(c) => setCoords(c)}
            baseLayer={baseMap === "satellite" ? "satellite" : "osm"}
            weatherLayer={weatherLayer as any}
            weatherOpacity={weatherOpacity}
            floodOn={floodOn}
            bottomLeftOverlay={<WeatherMiniCard coords={coords} />}
            overlay={
              <MapLayersPanel
                open={layersOpen}
                onOpenChange={setLayersOpen}
                baseMap={baseMap}
                onBaseMapChange={(v) => {
                  if (v === "satellite" && !hasMapboxToken) {
                    toast.error("Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar Satélite");
                    return;
                  }
                  setBaseMap(v);
                }}
                weather={weather}
                onWeatherChange={setWeather}
                opacity={weatherOpacity}
                onOpacityChange={setWeatherOpacity}
                floodOn={floodOn}
                onFloodToggle={() => {
                  setFloodOn((prev) => {
                    const next = !prev;
                    toast.message(
                      next ? "Inundaciones (Q100) activadas" : "Inundaciones (Q100) desactivadas"
                    );
                    return next;
                  });
                }}
              />
            }
          />
        </div>
      </div>

      {/* Dialog ubicaciones guardadas */}
      <SavedLocationsDialog
        open={savedOpen}
        onOpenChange={setSavedOpen}
        items={savedLocations}
        onLoad={handleLoadSaved}
        onDelete={handleDeleteSaved}
        onUpdateNote={handleUpdateNote}
      />

      {/* Print-friendly report */}
      {result ? <PrintReport result={result} /> : null}
    </main>
  );
}
