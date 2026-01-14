"use client";

import { useEffect, useMemo, useState } from "react";
import { Thermometer, Wind, CloudRain, Waves, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LatLon } from "@/types/analysis";

type WeatherMini = {
  tempC: number | null;
  windMs: number | null;
  rain1hMm: number | null;
  description: string | null;
};

type FloodInfo = {
  inside: boolean;
};

function riskFrom(inside: boolean, rain1hMm: number | null) {
  if (!inside) return { level: "Bajo" as const, reason: "Fuera de Q100" };
  if (rain1hMm == null) return { level: "Medio" as const, reason: "En Q100, sin dato lluvia 1h" };
  if (rain1hMm < 1) return { level: "Medio" as const, reason: "En Q100, lluvia debil" };
  if (rain1hMm < 5) return { level: "Alto" as const, reason: "En Q100, lluvia moderada" };
  return { level: "Muy alto" as const, reason: "En Q100, lluvia intensa" };
}

export function WeatherMiniCard({ coords }: { coords: LatLon | null }) {
  const [wx, setWx] = useState<WeatherMini | null>(null);
  const [flood, setFlood] = useState<FloodInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!coords) {
      setWx(null);
      setFlood(null);
      setErrMsg(null);
      return;
    }

    const ac = new AbortController();

    (async () => {
      setLoading(true);
      setErrMsg(null);

      try {
        const wxUrl = `/api/weather/current?lat=${coords.lat}&lon=${coords.lon}`;
        const floodUrl = `/api/flood/feature-info?lat=${coords.lat}&lon=${coords.lon}`;

        const [wxRes, floodRes] = await Promise.all([
          fetch(wxUrl, { signal: ac.signal }),
          fetch(floodUrl, { signal: ac.signal }),
        ]);

        const wxJson = await wxRes.json().catch(() => ({}));
        const floodJson = await floodRes.json().catch(() => ({}));

        if (!wxRes.ok) {
          throw new Error(`Weather error (${wxRes.status}): ${wxJson?.error ?? "sin detalle"}`);
        }
        if (!floodRes.ok) {
          throw new Error(`Flood error (${floodRes.status}): ${floodJson?.error ?? "sin detalle"}`);
        }

        setWx({
          tempC: wxJson?.tempC ?? null,
          windMs: wxJson?.windMs ?? null,
          rain1hMm: wxJson?.rain1hMm ?? null,
          description: wxJson?.description ?? null,
        });

        setFlood({ inside: !!floodJson?.inside });
      } catch (e: any) {
        if (!ac.signal.aborted) {
          setWx(null);
          setFlood(null);
          setErrMsg(e?.message ?? "Error cargando meteo/inundacion");
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [coords?.lat, coords?.lon]);

  const risk = useMemo(() => {
    const inside = flood?.inside ?? false;
    const rain1h = wx?.rain1hMm ?? null;
    return riskFrom(inside, rain1h);
  }, [flood?.inside, wx?.rain1hMm]);

  if (!coords) return null;

  const badgeVariant = risk.level === "Bajo" ? "secondary" : "default";

  return (
    <Card className="w-full max-w-[720px] rounded-2xl border bg-background/90 p-3 shadow-lg backdrop-blur">
      {errMsg ? (
        <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
          <AlertTriangle className="h-4 w-4" />
          <div className="leading-snug">
            <div className="font-medium">No disponible</div>
            <div className="text-muted-foreground">{errMsg}</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge className="gap-1">
            <span className="text-foreground text-white">Riesgo</span>
              <Waves className="h-3.5 w-3.5" />
              {risk.level}
            </Badge>
            <span>({risk.reason})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Thermometer className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">Temp</span>
            <span className="tabular-nums font-medium">
              {loading ? "--" : wx?.tempC?.toFixed(1) ?? "--"} C
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Wind className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">Viento</span>
            <span className="tabular-nums font-medium">
              {loading ? "--" : wx?.windMs?.toFixed(1) ?? "--"} m/s
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <CloudRain className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">Lluvia 1h</span>
            <span className="tabular-nums font-medium">
              {loading ? "--" : wx?.rain1hMm?.toFixed(1) ?? "0.0"} mm
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
