"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Layers,
  Map as MapIcon,
  Satellite,
  Mountain,
  Moon,
  Thermometer,
  CloudRain,
  Cloud,
  Wind,
  Waves,
  Globe,
  Cuboid,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

type BaseMap = "streets" | "satellite" | "outdoors" | "dark";
type Weather = "none" | "temp" | "precipitation" | "clouds" | "wind";

type EfasLayerInfo = {
  name: string;
  title?: string;
  abstract?: string;
  queryable?: boolean;
};

const WEATHER_TO_OWM: Record<Exclude<Weather, "none">, string> = {
  temp: "temp_new",
  precipitation: "precipitation_new",
  clouds: "clouds_new",
  wind: "wind_new",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  baseMap: BaseMap;
  onBaseMapChange: (v: BaseMap) => void;

  weather: Weather;
  onWeatherChange: (v: Weather) => void;

  opacity: number; // 0..1
  onOpacityChange: (v: number) => void;

  floodOn: boolean;
  onFloodToggle: () => void;

  // EFAS
  efasOn: boolean;
  onEfasToggle: () => void;
  onEfasEnable: () => void;
  efasLayer: string | null;
  onEfasLayerChange: (v: string | null) => void;
  efasOpacity: number; // 0..1
  onEfasOpacityChange: (v: number) => void;

  terrain3d: boolean;
  onTerrain3dToggle: () => void;
};

export default function MapLayersPanel({
  open,
  onOpenChange,

  baseMap,
  onBaseMapChange,

  weather,
  onWeatherChange,

  opacity,
  onOpacityChange,

  floodOn,
  onFloodToggle,

  efasOn,
  onEfasToggle,
  onEfasEnable,
  efasLayer,
  onEfasLayerChange,
  efasOpacity,
  onEfasOpacityChange,

  terrain3d,
  onTerrain3dToggle,
}: Props) {
  const opacityPct = useMemo(() => Math.round(opacity * 100), [opacity]);
  const efasOpacityPct = useMemo(() => Math.round(efasOpacity * 100), [efasOpacity]);
  const selectedWeatherLayer = weather === "none" ? null : WEATHER_TO_OWM[weather];

  const [efasLayers, setEfasLayers] = useState<EfasLayerInfo[]>([]);
  const [efasLoading, setEfasLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        setEfasLoading(true);
        const res = await fetch("/api/copernicus/efas/capabilities");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "No se pudo cargar EFAS capabilities");

        const layers = Array.isArray(json?.layers) ? (json.layers as EfasLayerInfo[]) : [];
        setEfasLayers(layers);

        if (!efasLayer && layers.length) {
          const preferred = layers.find((l) => l.queryable) || layers[0];
          onEfasLayerChange(preferred?.name ?? null);
        }
      } catch (e: any) {
        setEfasLayers([]);
        toast.error(e?.message || "Error cargando capas EFAS");
      } finally {
        setEfasLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [open]);

  if (!open) {
    return (
      <Button
        variant="default"
        size="icon"
        className="shadow"
        onClick={() => onOpenChange(true)}
        aria-label="Capas del mapa"
      >
        <Layers className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Card id="onborda-layers-panel" className="glass-panel w-[360px] shadow-lg layers-panel">
      <CardHeader className="layers-panel__header flex flex-row items-center justify-between py-3">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Capas del mapa
        </div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="layers-panel__content space-y-4 pb-1">
        {/* BASE MAP */}
        <div id="onborda-base-map" className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">MAPA BASE</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={baseMap === "streets" ? "default" : "outline"}
              onClick={() => onBaseMapChange("streets")}
              className="justify-start gap-2"
            >
              <MapIcon className="h-4 w-4" />
              Streets
            </Button>

            <Button
              variant={baseMap === "satellite" ? "default" : "outline"}
              onClick={() => onBaseMapChange("satellite")}
              className="justify-start gap-2"
            >
              <Satellite className="h-4 w-4" />
              Satelite
            </Button>

            <Button
              variant={baseMap === "outdoors" ? "default" : "outline"}
              onClick={() => onBaseMapChange("outdoors")}
              className="justify-start gap-2"
            >
              <Mountain className="h-4 w-4" />
              Outdoors
            </Button>

            <Button
              variant={baseMap === "dark" ? "default" : "outline"}
              onClick={() => onBaseMapChange("dark")}
              className="justify-start gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
          </div>
          <Button
            variant={terrain3d ? "default" : "outline"}
            onClick={onTerrain3dToggle}
            className="w-full justify-start gap-2"
          >
            <Cuboid className="h-4 w-4" />
            3D Terrain
          </Button>
        </div>

        <Separator />

        {/* WEATHER */}
        <div id="onborda-weather" className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">METEO (OpenWeather)</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={weather === "temp" ? "default" : "outline"}
              onClick={() => onWeatherChange(weather === "temp" ? "none" : "temp")}
              className="justify-start gap-2"
            >
              <Thermometer className="h-4 w-4" />
              Temp
            </Button>

            <Button
              variant={weather === "precipitation" ? "default" : "outline"}
              onClick={() =>
                onWeatherChange(weather === "precipitation" ? "none" : "precipitation")
              }
              className="justify-start gap-2"
            >
              <CloudRain className="h-4 w-4" />
              Precip
            </Button>

            <Button
              variant={weather === "clouds" ? "default" : "outline"}
              onClick={() => onWeatherChange(weather === "clouds" ? "none" : "clouds")}
              className="justify-start gap-2"
            >
              <Cloud className="h-4 w-4" />
              Nubes
            </Button>

            <Button
              variant={weather === "wind" ? "default" : "outline"}
              onClick={() => onWeatherChange(weather === "wind" ? "none" : "wind")}
              className="justify-start gap-2"
            >
              <Wind className="h-4 w-4" />
              Viento
            </Button>
          </div>
        </div>

        <div id="onborda-weather-opacity" className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Opacidad meteo</div>
            <div className="text-xs">{opacityPct}%</div>
          </div>
          <div className="overflow-hidden pr-1">
          <Slider
            value={[opacityPct]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => onOpacityChange((v[0] ?? 0) / 100)}
          />
          </div>
        </div>

        <Separator />

        {/* Q100 */}
        <div id="onborda-flood" className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">RIESGOS (SNCZI)</div>
          <Button
            id="onborda-flood-button"
            variant={floodOn ? "default" : "outline"}
            onClick={onFloodToggle}
            className="w-full justify-start gap-2"
          >
            <Waves className="h-4 w-4" />
            Inundaciones (Q100)
          </Button>
          <div className="text-xs text-muted-foreground">Capa WMS oficial (T=100 anos).</div>
        </div>

        <Separator />

        {/* EFAS */}
        <div id="onborda-efas" className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">COPERNICUS (EFAS)</div>

          <Button
            variant={efasOn ? "default" : "outline"}
            onClick={onEfasToggle}
            className="w-full justify-start gap-2"
          >
            <Globe className="h-4 w-4" />
            EFAS (WMS)
          </Button>

          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Capa EFAS</div>

            <select
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              disabled={efasLoading || !efasLayers.length}
              value={efasLayer ?? ""}
              onChange={(e) => {
                const next = e.target.value || null;
                onEfasLayerChange(next);

                // When layer changes, ensure EFAS is active.
                if (next && !efasOn) onEfasEnable();

                toast.message(next ? "Capa EFAS seleccionada" : "Capa EFAS deseleccionada");
              }}
            >
              {!efasLayers.length ? (
                <option value="">
                  {efasLoading ? "Cargando capas..." : "Sin capas disponibles"}
                </option>
              ) : null}

              {efasLayers.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.title ? l.title : l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">Opacidad EFAS</div>
              <div className="text-xs">{efasOpacityPct}%</div>
            </div>
          <div className="overflow-hidden pr-1">
            <Slider
              value={[efasOpacityPct]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => onEfasOpacityChange((v[0] ?? 0) / 100)}
            />
          </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}





