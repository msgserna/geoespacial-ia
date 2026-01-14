"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  WMSTileLayer,
} from "react-leaflet";
import type { LatLon } from "@/types/analysis";

type BaseLayer = "osm" | "satellite";

export type WeatherLayer =
  | "temp_new"
  | "precipitation_new"
  | "clouds_new"
  | "wind_new";

type MapViewProps = {
  value?: LatLon | null;
  onPick: (coords: LatLon) => void;

  baseLayer?: BaseLayer;

  weatherLayer?: WeatherLayer | null;
  weatherOpacity?: number;

  floodOn?: boolean;

  // EFAS
  efasOn?: boolean;
  efasLayer?: string | null;
  efasOpacity?: number;
  efasTime?: string | null;

  overlay?: React.ReactNode;
  bottomLeftOverlay?: React.ReactNode;
};

function ClickHandler({ onPick }: { onPick: (c: LatLon) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export function MapView({
  value,
  onPick,
  baseLayer = "osm",
  weatherLayer = null,
  weatherOpacity = 0.8,
  floodOn = false,

  efasOn = false,
  efasLayer = null,
  efasOpacity = 0.6,
  efasTime = null,

  overlay,
  bottomLeftOverlay,
}: MapViewProps) {
  useEffect(() => {
    (async () => {
      try {
        await import("leaflet-defaulticon-compatibility");
      } catch {}
    })();
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (value) return [value.lat, value.lon];
    return [40.4167, -3.7033];
  }, [value]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const mapboxSatelliteUrl = mapboxToken
    ? `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=${mapboxToken}`
    : null;

  const isSatellite = baseLayer === "satellite" && !!mapboxSatelliteUrl;

  const attributionOSM =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const attributionMapbox =
    '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  const weatherUrl = weatherLayer
    ? `/api/weather/tiles/${weatherLayer}/{z}/{x}/{y}.png`
    : null;

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden">
      {overlay ? <div className="absolute right-3 top-3 z-[1200]">{overlay}</div> : null}
      {bottomLeftOverlay ? (
        <div className="absolute bottom-4 left-1/2 z-[1200] -translate-x-1/2 transform">
          {bottomLeftOverlay}
        </div>
      ) : null}

      <MapContainer center={center} zoom={value ? 14 : 6} className="h-full w-full">
        {isSatellite ? (
          <TileLayer attribution={attributionMapbox} url={mapboxSatelliteUrl!} maxZoom={19} />
        ) : (
          <TileLayer
            attribution={attributionOSM}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        )}

        {weatherUrl ? (
          <TileLayer
            url={weatherUrl}
            opacity={Math.min(1, Math.max(0, weatherOpacity))}
            zIndex={500}
          />
        ) : null}

        {/* Q100 (WMS) */}
        {floodOn ? (
          <WMSTileLayer
            url="https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100"
            layers="NZ.RiskZone"
            format="image/png"
            transparent
            version="1.3.0"
            opacity={0.65}
            zIndex={650}
          />
        ) : null}

        {/* EFAS (Copernicus) — WMS-T overlay */}
        {efasOn && efasLayer ? (
          <WMSTileLayer
            key={`efas-${efasLayer}-${efasTime ?? "notime"}`} // ✅ fuerza remount al cambiar capa/tiempo
            url="https://european-flood.emergency.copernicus.eu/api/wms/"
            layers={efasLayer}
            format="image/png"
            transparent
            version="1.3.0"
            opacity={Math.min(1, Math.max(0, efasOpacity))}
            zIndex={700}
            // ✅ params extra (TIME + cache-buster)
            {...(({ time: efasTime || undefined, _ts: `${efasLayer}-${efasTime ?? "notime"}` } as unknown) as any)}
          />
        ) : null}

        <ClickHandler onPick={onPick} />

        {value ? (
          <Marker position={[value.lat, value.lon]}>
            <Popup>
              <div className="text-sm">
                <div>
                  <b>Coordenadas</b>
                </div>
                <div>lat: {value.lat.toFixed(6)}</div>
                <div>lon: {value.lon.toFixed(6)}</div>
              </div>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
