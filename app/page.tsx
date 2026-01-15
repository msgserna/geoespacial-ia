"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalysisResponse, LatLon } from "@/types/analysis";

import { AddressSearch } from "@/components/search/address-search";
import { ReportPanel } from "@/components/report/report-panel";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, FileDown, Save, Bookmark, Eraser, Sparkles, Moon, Sun } from "lucide-react";

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

// MapLayersPanel es default export
import MapLayersPanel from "@/components/map/map-layers-panel";
import { WeatherMiniCard } from "@/components/map/weather-mini-card";

// MapView solo en cliente (evita window is not defined)
const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] w-full rounded-xl border md:h-[calc(100vh-3.5rem)]" />
  ),
});

export default function Page() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<LatLon | null>(null);

  const [loading, setLoading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Saved locations
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  // Layers
  const [layersOpen, setLayersOpen] = useState(false);
  const [baseMap, setBaseMap] = useState<"streets" | "satellite" | "outdoors" | "dark">(
    "streets"
  );

  const [weather, setWeather] = useState<"none" | "temp" | "precipitation" | "clouds" | "wind">(
    "none"
  );
  const [weatherOpacity, setWeatherOpacity] = useState(0.8);

  const [floodOn, setFloodOn] = useState(false);

  // EFAS
  const [efasOn, setEfasOn] = useState(false);
  const [efasLayer, setEfasLayer] = useState<string | null>(null);
  const [efasOpacity, setEfasOpacity] = useState(0.7);
  const [efasTime, setEfasTime] = useState<string | null>(null);

  const hasMapboxToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [terrain3d, setTerrain3d] = useState(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasResults = loading || !!result || !!error;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Normaliza la respuesta del API a la forma que consumen los paneles (data.*),
  // sin perder la estructura original que ya se imprime/guarda.
  function normalizeResult(raw: any): AnalysisResponse {
    const coordsSafe =
      raw?.coords && typeof raw.coords.lat === "number" && typeof raw.coords.lon === "number"
        ? raw.coords
        : { lat: Number(raw?.lat) || 0, lon: Number(raw?.lon) || 0, label: raw?.label ?? null };

    const dataBlock: AnalysisResponse["data"] = {};

    if ("geocode" in (raw?.data ?? {})) {
      dataBlock.geocode = (raw.data as any).geocode;
    }

    if ("urban" in raw) {
      dataBlock.urban = { ok: raw.urban != null, data: raw.urban ?? undefined };
    } else if ("urban" in (raw?.data ?? {})) {
      dataBlock.urban = (raw.data as any).urban;
    }

    if ("floodQ100" in raw) {
      dataBlock.flood = { ok: raw.floodQ100 != null, data: raw.floodQ100 ?? undefined };
    } else if ("flood" in (raw?.data ?? {})) {
      dataBlock.flood = (raw.data as any).flood;
    }

    if ("meteo" in raw) {
      dataBlock.meteo = { ok: raw.meteo != null, data: raw.meteo ?? undefined };
    } else if ("meteo" in (raw?.data ?? {})) {
      dataBlock.meteo = (raw.data as any).meteo;
    }

    if ("dynamicFloodRisk" in raw) {
      dataBlock.dynamicFloodRisk = {
        ok: raw.dynamicFloodRisk != null,
        data: raw.dynamicFloodRisk ?? undefined,
      };
    } else if ("dynamicFloodRisk" in (raw?.data ?? {})) {
      dataBlock.dynamicFloodRisk = (raw.data as any).dynamicFloodRisk;
    }

    if ("efas" in raw) {
      dataBlock.efas = { ok: raw.efas != null, data: raw.efas ?? undefined };
    } else if ("efas" in (raw?.data ?? {})) {
      dataBlock.efas = (raw.data as any).efas;
    }

    const mapImageUrl =
      raw?.mapImageUrl ||
      (mapboxToken && coordsSafe?.lat && coordsSafe?.lon
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+0f766e(${coordsSafe.lon},${coordsSafe.lat})/${coordsSafe.lon},${coordsSafe.lat},14,0/800x420?access_token=${encodeURIComponent(
            mapboxToken
          )}`
        : null);

    const normalizedSources = Array.isArray(raw?.sources)
      ? raw.sources
      : raw?.sources && typeof raw.sources === "object"
        ? Object.values(raw.sources)
        : [];

    return {
      ...raw,
      coords: coordsSafe,
      mapImageUrl,
      data: dataBlock,
      report: raw?.report ?? "",
      sources: normalizedSources,
      limitations: Array.isArray(raw?.limitations) ? raw.limitations : [],
    };
  }

  useEffect(() => {
    const loaded = loadSavedLocations().map((it) => ({
      ...it,
      snapshot: normalizeResult(it.snapshot),
    }));
    setSavedLocations(loaded);
  }, []);

  useEffect(() => {
    saveSavedLocations(savedLocations);
  }, [savedLocations]);

  // (opcional) preparar TIME para EFAS si tu endpoint lo devuelve
  useEffect(() => {
    if (!efasLayer) {
      setEfasTime(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/copernicus/efas/capabilities?layer=${encodeURIComponent(efasLayer)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "EFAS capabilities error");
        setEfasTime(typeof json?.defaultTime === "string" ? json.defaultTime : null);
      } catch {
        setEfasTime(null);
      }
    })();
  }, [efasLayer]);

  const coordLabel = useMemo(() => {
    if (!coords) return "Sin seleccion";
    return `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`;
  }, [coords]);

  async function analyze(payload: {
    address?: string;
    lat?: number;
    lon?: number;
    floodOn?: boolean;
    efasOn?: boolean;
    efasLayer?: string | null;
    efasTime?: string | null;
  }) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = (await res.json()) as AnalysisResponse & { error?: string };
      if (!res.ok) throw new Error(raw?.error || "Error en el analisis");

      const normalized = normalizeResult(raw);
      setResult(normalized);

      if (
        typeof normalized.coords?.lat === "number" &&
        typeof normalized.coords?.lon === "number"
      ) {
        setCoords({ lat: normalized.coords.lat, lon: normalized.coords.lon });
      }

      toast.success("Analisis completado");
    } catch (e: any) {
      setResult(null);
      setError(e?.message || "Error inesperado");
      toast.error("No se pudo completar el analisis");
    } finally {
      setLoading(false);
    }
  }

  async function goToAddress() {
    const query = address.trim();
    if (query.length < 4) return;

    setGeocodeLoading(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: query }),
      });

      const raw = (await res.json()) as { coords?: LatLon; error?: string };
      if (!res.ok) throw new Error(raw?.error || "No se pudo geocodificar la direccion");

      if (raw?.coords) {
        setCoords({ lat: raw.coords.lat, lon: raw.coords.lon });
        toast.message("Ubicacion encontrada");
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo geocodificar la direccion");
    } finally {
      setGeocodeLoading(false);
    }
  }

  function handleSuggestionPick(s: { label: string; lat: number; lon: number }) {
    setAddress(s.label);
    setCoords({ lat: s.lat, lon: s.lon });
    toast.message("Ubicacion encontrada");
  }

  function handleSaveCurrent() {
    if (!result) return toast.error("No hay analisis para guardar");

    const lat = result.coords?.lat;
    const lon = result.coords?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") {
      return toast.error("El analisis no tiene coordenadas validas");
    }

    const title =
      result.coords.label?.trim() || address.trim() || `Ubicacion ${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    const item = createSavedLocation({
      title,
      coords: { lat, lon },
      snapshot: result,
      note: "",
    });

    setSavedLocations((prev) => [item, ...prev]);
    toast.success("Ubicacion guardada");
  }

  function handleLoadSaved(item: SavedLocation) {
    setCoords(item.coords);
    setResult(item.snapshot);
    setError(null);
    setAddress(item.title);
    toast.message("Ubicacion cargada");
  }

  function handleDeleteSaved(id: string) {
    setSavedLocations((prev) => removeLocation(prev, id));
    toast.message("Ubicacion eliminada");
  }

  function handleUpdateNote(id: string, note: string) {
    setSavedLocations((prev) => updateLocationNote(prev, id, note));
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
    <main className="relative h-dvh overflow-hidden">
      <div className="absolute inset-0 print:hidden">
        <MapView
          value={coords}
          onPick={(c: LatLon) => setCoords(c)}
          baseLayer={baseMap}
          weatherLayer={weatherLayer as any}
          weatherOpacity={weatherOpacity}
          floodOn={floodOn}
          efasOn={efasOn}
          efasLayer={efasLayer}
          efasOpacity={efasOpacity}
          efasTime={efasTime}
          terrain3d={terrain3d}
          bottomLeftOverlay={<WeatherMiniCard coords={coords} />}
          overlay={
            <MapLayersPanel
              open={layersOpen}
              onOpenChange={setLayersOpen}
              baseMap={baseMap}
              onBaseMapChange={(v) => {
                if (!hasMapboxToken) {
                  toast.error("Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar Mapbox");
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
                  toast.message(next ? "Inundaciones (Q100) activadas" : "Inundaciones (Q100) desactivadas");
                  return next;
                });
              }}
              efasOn={efasOn}
              onEfasToggle={() => {
                setEfasOn((prev) => {
                  const next = !prev;
                  toast.message(next ? "Copernicus EFAS activado" : "Copernicus EFAS desactivado");
                  return next;
                });
              }}
              onEfasEnable={() => {
                setEfasOn(true);
                toast.message("Copernicus EFAS activado");
              }}
              efasLayer={efasLayer}
              onEfasLayerChange={setEfasLayer}
              efasOpacity={efasOpacity}
              onEfasOpacityChange={setEfasOpacity}
              terrain3d={terrain3d}
              onTerrain3dToggle={() => setTerrain3d((prev) => !prev)}
            />
          }
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1400] p-4 md:p-6 print:hidden">
        <div
          className={`glass-panel pointer-events-auto flex max-w-[440px] flex-col gap-4 rounded-2xl p-4 text-sm ${
            hasResults ? "h-full overflow-y-auto" : "h-auto"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-semibold">Asistente Geoespacial</div>
            <div className="flex items-center gap-2">
              {mounted ? (
                <>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    aria-label="Cambiar tema"
                  />
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  )}
                </>
              ) : (
                <div className="h-5 w-14" />
              )}
            </div>
          </div>

          <div className="text-sm">
            <AddressSearch
              address={address}
              onAddressChange={setAddress}
              onAnalyzeByAddress={goToAddress}
              onSuggestionPick={handleSuggestionPick}
              disabled={loading || geocodeLoading}
            />
          </div>

          <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                coords ? "bg-emerald-500" : "bg-muted-foreground/60"
              }`}
              aria-label={coords ? "Punto seleccionado" : "Sin punto"}
            />
            <div className="text-[11px] font-medium text-foreground">{coordLabel}</div>
          </div>

          <TooltipProvider>
            <div className="grid grid-cols-3 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={loading}
                    aria-label="Limpiar"
                    onClick={() => {
                      setAddress("");
                      setCoords(null);
                      setResult(null);
                      setError(null);
                      toast.message("Limpio");
                    }}
                  >
                    <Eraser className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Limpiar
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    variant={coords ? "default" : "secondary"}
                    disabled={!coords || loading}
                    aria-label="Analizar punto"
                    onClick={() =>
                      coords &&
                      analyze({
                        lat: coords.lat,
                        lon: coords.lon,
                        floodOn,
                        efasOn,
                        efasLayer,
                        efasTime,
                      })
                    }
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Analizar punto
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg" variant="outline" disabled aria-label="Proximamente">
                    <Sparkles className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Proximamente
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg" variant="outline" aria-label="Guardadas" onClick={() => setSavedOpen(true)}>
                    <Bookmark className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Guardadas
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="lg" disabled={!result || loading} aria-label="Guardar ubicacion" onClick={handleSaveCurrent}>
                    <Save className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Guardar ubicacion
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={!result}
                    aria-label="Pdf"
                    onClick={() =>
                      result ? window.print() : toast.error("No hay informe para exportar")
                    }
                  >
                    <FileDown className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  Pdf
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <div className="text-[11px] text-muted-foreground">
            La IA se basa en datos reales. Si una fuente no responde, se indicara como limitacion.
          </div>

          {hasResults ? (
            <div className="min-h-0 flex-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
              <ReportPanel loading={loading} result={result} error={error} />
            </div>
          ) : null}
        </div>
      </div>

      <SavedLocationsDialog
        open={savedOpen}
        onOpenChange={setSavedOpen}
        items={savedLocations}
        onLoad={handleLoadSaved}
        onDelete={handleDeleteSaved}
        onUpdateNote={handleUpdateNote}
      />

      {result ? <PrintReport result={result} /> : null}
    </main>
  );
}
