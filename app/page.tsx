"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalysisResponse, LatLon } from "@/types/analysis";

import { AddressSearch } from "@/components/search/address-search";
import { ReportPanel } from "@/components/report/report-panel";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, FileDown, Save, Bookmark, Eraser, HelpCircle, Moon, Sun, Compass } from "lucide-react";
import { Onborda, OnbordaProvider, useOnborda } from "onborda";

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
import { OnbordaCard } from "@/components/onborda/onborda-card";

// MapView solo en cliente (evita window is not defined)
const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] w-full rounded-xl border md:h-[calc(100vh-3.5rem)]" />
  ),
});

const ONBORDA_SEEN_KEY = "onborda:seen";

export default function Page() {
  return (
    <OnbordaProvider>
      <PageContent />
    </OnbordaProvider>
  );
}

function PageContent() {
  const { theme, setTheme } = useTheme();
  const { startOnborda, isOnbordaVisible, currentStep, currentTour } = useOnborda();
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

  const [tourActive, setTourActive] = useState(false);
  const preTourLayersOpenRef = useRef<boolean | null>(null);
  const preTourSavedOpenRef = useRef<boolean | null>(null);
  const autoTourStartedRef = useRef(false);
  const tourShownRef = useRef(false);

  // Layers
  const [layersOpen, setLayersOpen] = useState(true);
  const layersOpenRef = useRef(layersOpen);
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
  const showResultsPanel = hasResults || tourActive;

  useEffect(() => {
    setMounted(true);
  }, []);

  const startTour = useCallback(() => {
    preTourLayersOpenRef.current = layersOpenRef.current;
    preTourSavedOpenRef.current = savedOpen;
    autoTourStartedRef.current = true;
    tourShownRef.current = false;
    setLayersOpen(true);
    setSavedOpen(false);
    setTourActive(true);
    setTimeout(() => startOnborda("main"), 220);
  }, [savedOpen, startOnborda]);

  useEffect(() => {
    layersOpenRef.current = layersOpen;
  }, [layersOpen]);

  useEffect(() => {
    if (!mounted) return;
    if (autoTourStartedRef.current) return;
    const seen = localStorage.getItem(ONBORDA_SEEN_KEY);
    if (!seen) {
      autoTourStartedRef.current = true;
      startTour();
    }
  }, [mounted, startTour]);

  useEffect(() => {
    if (tourActive) {
      setLayersOpen(true);
    }
  }, [tourActive]);

  useEffect(() => {
    if (isOnbordaVisible) {
      tourShownRef.current = true;
      return;
    }
    if (!tourActive || !tourShownRef.current) return;
    localStorage.setItem(ONBORDA_SEEN_KEY, "1");
    setTourActive(false);
    tourShownRef.current = false;
    if (preTourLayersOpenRef.current !== null) {
      setLayersOpen(preTourLayersOpenRef.current);
      preTourLayersOpenRef.current = null;
    }
    if (preTourSavedOpenRef.current !== null) {
      setSavedOpen(preTourSavedOpenRef.current);
      preTourSavedOpenRef.current = null;
    }
  }, [tourActive, isOnbordaVisible]);

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

  const onbordaSteps = useMemo(
    () => [
      {
        tour: "main",
        steps: [
          {
            title: "Bienvenido",
            content:
              "Este es tu Asistente Geoespacial. Aqui evaluas riesgos y contexto del punto elegido.",
            selector: "#onborda-welcome-anchor",
            side: "bottom",
            pointerPadding: 6,
            pointerRadius: 10,
          },
          {
            title: "Buscar o seleccionar",
            content:
              "Busca una direccion o selecciona un punto directamente en el mapa.",
            selector: "#onborda-search",
            side: "bottom",
            pointerPadding: 12,
            pointerRadius: 16,
          },
          {
            title: "Menu de capas",
            content: "Desde aqui controlas las capas y el mapa base.",
            selector: "#onborda-layers-panel",
            side: "left",
            pointerPadding: 12,
            pointerRadius: 16,
          },
          {
            title: "Mapa base",
            content: "Cambia el estilo base del mapa segun el contexto.",
            selector: "#onborda-base-map",
            side: "left",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Meteo",
            content: "Activa capas de temperatura, precipitacion, nubes o viento.",
            selector: "#onborda-weather",
            side: "left",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Inundaciones Q100",
            content: "Capa oficial de riesgo de inundacion (periodo de retorno 100).",
            selector: "#onborda-flood-button",
            side: "left",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Copernicus EFAS",
            content: "Capa europea de alerta temprana; ajusta la capa y opacidad.",
            selector: "#onborda-efas",
            side: "left",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Mini-card",
            content: "Resumen rapido del punto: riesgo, temp, viento y lluvia.",
            selector: "#onborda-mini-card",
            side: "top",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Analizar punto",
            content: "Lanza el analisis cuando tengas un punto seleccionado.",
            selector: "#onborda-analyze",
            side: "right",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Resultados",
            content: "Aqui aparecera el informe con datos, fuentes y limitaciones.",
            selector: "#onborda-results",
            side: "right",
            pointerPadding: 12,
            pointerRadius: 16,
          },
          {
            title: "Guardar ubicacion",
            content: "Guarda el punto actual para revisarlo mas tarde.",
            selector: "#onborda-save",
            side: "right",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Ubicaciones guardadas",
            content: "Accede al historial de ubicaciones guardadas.",
            selector: "#onborda-saved",
            side: "right",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Limpiar",
            content: "Reinicia la busqueda y el estado actual.",
            selector: "#onborda-clear",
            side: "right",
            pointerPadding: 10,
            pointerRadius: 14,
          },
          {
            title: "Descargar informe",
            content: "Cuando haya informe, puedes exportarlo en PDF.",
            selector: "#onborda-download",
            side: "right",
            pointerPadding: 10,
            pointerRadius: 14,
          },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    if (!tourActive || currentTour !== "main") return;
    setSavedOpen(false);
  }, [tourActive, currentTour, currentStep]);

  return (
    <Onborda
      steps={onbordaSteps}
      cardComponent={OnbordaCard}
      shadowRgb="15, 23, 42"
      shadowOpacity="0.55"
      interact={false}
    >
      <main className="relative h-dvh overflow-hidden">
        <div
          id="onborda-welcome-anchor"
          className="pointer-events-none fixed left-1/2 top-[22%] h-1 w-1 -translate-x-1/2 -translate-y-1/2"
        />
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
            tourMarker={tourActive && !coords && currentTour === "main" && currentStep > 0}
            bottomLeftOverlay={
              <div id="onborda-mini-card">
                <WeatherMiniCard coords={coords} tourActive={tourActive} />
              </div>
            }
            overlay={
              <MapLayersPanel
                open={layersOpen}
                onOpenChange={(v) => {
                  if (tourActive && !v) return;
                  setLayersOpen(v);
                }}
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
              showResultsPanel ? "h-full overflow-y-auto" : "h-auto"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div id="onborda-title" className="flex items-center gap-2 text-base font-semibold">
                <Compass className="h-4 w-4 text-primary dark:text-white" />
                <span>Asistente Geoespacial</span>
              </div>
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
                      id="onborda-tour-trigger"
                      size="lg"
                      variant="outline"
                      aria-label="Guia interactiva"
                      onClick={startTour}
                    >
                      <HelpCircle className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Guia interactiva
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="onborda-clear"
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
                      id="onborda-analyze"
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
                    <Button
                      id="onborda-download"
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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="onborda-saved"
                      size="lg"
                      variant="outline"
                      aria-label="Guardadas"
                      onClick={() => setSavedOpen(true)}
                    >
                      <Bookmark className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Guardadas
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      id="onborda-save"
                      size="lg"
                      disabled={!result || loading}
                      aria-label="Guardar ubicacion"
                      onClick={handleSaveCurrent}
                    >
                      <Save className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Guardar ubicacion
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            <div className="text-[11px] text-muted-foreground">
              La IA se basa en datos reales. Si una fuente no responde, se indicara como limitacion.
            </div>

            {showResultsPanel ? (
              <div
                id="onborda-results"
                className="min-h-0 flex-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {hasResults ? (
                  <ReportPanel loading={loading} result={result} error={error} />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-2xl bg-slate-200/80 px-6 py-10 text-center text-sm text-slate-700 dark:bg-slate-950/80 dark:text-slate-100">
                    <div className="max-w-[280px] text-base leading-relaxed">
                      Aqui veras el informe cuando analices un punto.
                    </div>
                  </div>
                )}
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
    </Onborda>
  );
}
