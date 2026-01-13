"use client";

import { useMemo } from "react";
import {
  X,
  Layers,
  Map as MapIcon,
  Satellite,
  Thermometer,
  CloudRain,
  Cloud,
  Wind,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

type BaseMap = "streets" | "satellite";
type Weather = "none" | "temp" | "precipitation" | "clouds" | "wind";

const WEATHER_TO_OWM: Record<Exclude<Weather, "none">, string> = {
  temp: "temp_new",
  precipitation: "precipitation_new",
  clouds: "clouds_new",
  wind: "wind_new",
};

export function MapLayersPanel({
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
}: {
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
}) {
  const opacityPct = useMemo(() => Math.round(opacity * 100), [opacity]);

  const selectedLayer =
    weather === "none" ? null : WEATHER_TO_OWM[weather];

  if (!open) {
    return (
      <Button
        variant="secondary"
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
    <Card className="w-[360px] shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="text-sm font-semibold">Capas del mapa</div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pb-1">
        <div className="space-y-2">
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
              Satélite
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
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
              Clouds
            </Button>

            <Button
              variant={weather === "wind" ? "default" : "outline"}
              onClick={() => onWeatherChange(weather === "wind" ? "none" : "wind")}
              className="justify-start gap-2"
            >
              <Wind className="h-4 w-4" />
              Wind
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Opacidad meteo</div>
            <div className="text-xs">{opacityPct}%</div>
          </div>
          <Slider
            value={[opacityPct]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => onOpacityChange((v[0] ?? 0) / 100)}
          />
          <div className="text-xs text-muted-foreground">
            {selectedLayer ? `Capa activa: ${selectedLayer}` : "Sin capa meteorológica activa"}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">RIESGOS (SNCZI)</div>

          <Button
            variant={floodOn ? "default" : "outline"}
            onClick={onFloodToggle}
            className="w-full justify-start gap-2"
          >
            <Waves className="h-4 w-4" />
            Inundaciones (Q100)
          </Button>

          <div className="text-xs text-muted-foreground">
            Capa WMS oficial (probabilidad media: T=100 años).
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
