"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalysisResponse, LatLon } from "@/types/analysis";

import { AddressSearch } from "@/components/search/address-search";
import { ReportPanel } from "@/components/report/report-panel";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, FileDown, Save, Bookmark } from "lucide-react";

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
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<LatLon | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Saved locations
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  // Layers
  const [layersOpen, setLayersOpen] = useState(false);
  const [baseMap, setBaseMap] = useState<"streets" | "satellite">("streets");

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

    return {
      ...raw,
      coords: coordsSafe,
      data: dataBlock,
      report: raw?.report ?? "",
      sources: (raw?.sources as any) ?? [],
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

  async function analyze(payload: { address?: string; lat?: number; lon?: number }) {
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
          baseLayer={baseMap === "satellite" ? "satellite" : "osm"}
          weatherLayer={weatherLayer as any}
          weatherOpacity={weatherOpacity}
          floodOn={floodOn}
          efasOn={efasOn}
          efasLayer={efasLayer}
          efasOpacity={efasOpacity}
          efasTime={efasTime}
          bottomLeftOverlay={<WeatherMiniCard coords={coords} />}
          overlay={
            <MapLayersPanel
              open={layersOpen}
              onOpenChange={setLayersOpen}
              baseMap={baseMap}
              onBaseMapChange={(v) => {
                if (v === "satellite" && !hasMapboxToken) {
                  toast.error("Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar Satelite");
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
            />
          }
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1400] p-4 md:p-6 print:hidden">
        <div className="pointer-events-auto flex h-full max-w-[440px] flex-col gap-4 overflow-y-auto rounded-2xl border bg-background/95 p-4 text-sm shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-semibold">Asistente Geoespacial</div>
            <Button
              size="sm"
              variant="outline"
              disabled={!result}
              onClick={() => (result ? window.print() : toast.error("No hay informe para exportar"))}
            >
              <FileDown className="h-4 w-4" />
              Pdf
            </Button>
          </div>

          <div className="text-sm">
            <AddressSearch
              address={address}
              onAddressChange={setAddress}
              onAnalyzeByAddress={() => analyze({ address })}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <Badge className="h-7 px-2 text-[11px]" variant={coords ? "default" : "secondary"}>
              {coords ? "OK" : "Sin punto"}
            </Badge>
            <div className="text-[11px] font-medium text-foreground">{coordLabel}</div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="w-1/3 text-[13px]"
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
            <Button
              size="sm"
              className="w-2/3 text-[13px]"
              variant={coords ? "default" : "secondary"}
              disabled={!coords || loading}
              onClick={() => coords && analyze({ lat: coords.lat, lon: coords.lon })}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Analizar punto
            </Button>
          </div>

          <div className="text-[11px] text-muted-foreground">
            La IA se basa en datos reales. Si una fuente no responde, se indicara como limitacion.
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="basis-1/2 text-[13px]"
              variant="outline"
              onClick={() => setSavedOpen(true)}
            >
              <Bookmark className="mr-2 h-4 w-4" />
              Guardadas
            </Button>
            <Button
              size="sm"
              className="basis-1/2 text-[13px]"
              disabled={!result || loading}
              onClick={handleSaveCurrent}
            >
              <Save className="mr-2 h-4 w-4" />
              Guardar ubicacion
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <ReportPanel loading={loading} result={result} error={error} />
          </div>
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
