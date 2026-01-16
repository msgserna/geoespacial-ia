"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { LatLon } from "@/types/analysis";

type BaseLayer = "streets" | "satellite" | "outdoors" | "dark";

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

  terrain3d?: boolean;

  overlay?: React.ReactNode;
  bottomLeftOverlay?: React.ReactNode;
};

const DEFAULT_CENTER: [number, number] = [-3.7033, 40.4167];

const MAPBOX_STYLES: Record<BaseLayer, string> = {
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  dark: "mapbox://styles/mapbox/dark-v11",
};

const WEATHER_SOURCE_ID = "weather-tiles";
const WEATHER_LAYER_ID = "weather-layer";
const FLOOD_SOURCE_ID = "flood-wms";
const FLOOD_LAYER_ID = "flood-layer";
const EFAS_SOURCE_ID = "efas-wms";
const EFAS_LAYER_ID = "efas-layer";
const TERRAIN_SOURCE_ID = "mapbox-dem";
const BUILDINGS_LAYER_ID = "3d-buildings";
const OVERLAY_ORDER = [FLOOD_LAYER_ID, WEATHER_LAYER_ID, EFAS_LAYER_ID];

export function MapView({
  value,
  onPick,
  baseLayer = "streets",
  weatherLayer = null,
  weatherOpacity = 0.8,
  floodOn = false,

  efasOn = false,
  efasLayer = null,
  efasOpacity = 0.6,
  efasTime = null,

  terrain3d = false,

  overlay,
  bottomLeftOverlay,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const center = useMemo<[number, number]>(() => {
    if (value) return [value.lon, value.lat];
    return DEFAULT_CENTER;
  }, [value]);

  function runWhenStyleReady(map: mapboxgl.Map, fn: () => void) {
    if (map.isStyleLoaded()) {
      fn();
      return;
    }
    map.once("style.load", fn);
  }

  function runWhenCompositeReady(map: mapboxgl.Map, fn: () => void) {
    if (map.getSource("composite") && map.isSourceLoaded("composite")) {
      fn();
      return;
    }

    const onSourceData = (e: mapboxgl.MapSourceDataEvent) => {
      if (e.sourceId === "composite" && map.isSourceLoaded("composite")) {
        map.off("sourcedata", onSourceData);
        fn();
      }
    };

    map.on("sourcedata", onSourceData);
  }

  function removeLayerAndSource(map: mapboxgl.Map, layerId: string, sourceId: string) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }

  function addRasterLayer(
    map: mapboxgl.Map,
    sourceId: string,
    layerId: string,
    tilesUrl: string,
    opacity: number
  ) {
    removeLayerAndSource(map, layerId, sourceId);
    map.addSource(sourceId, {
      type: "raster",
      tiles: [tilesUrl],
      tileSize: 256,
    });
    map.addLayer({
      id: layerId,
      type: "raster",
      source: sourceId,
      paint: {
        "raster-opacity": opacity,
      },
    });
  }

  function syncOverlayOrder(map: mapboxgl.Map) {
    for (let i = 0; i < OVERLAY_ORDER.length - 1; i += 1) {
      const layerId = OVERLAY_ORDER[i];
      const beforeId = OVERLAY_ORDER[i + 1];
      if (!map.getLayer(layerId) || !map.getLayer(beforeId)) continue;
      map.moveLayer(layerId, beforeId);
    }
  }

  function syncWeather(map: mapboxgl.Map) {
    if (weatherLayer) {
      const weatherUrl = `/api/weather/tiles/${weatherLayer}/{z}/{x}/{y}.png`;
      addRasterLayer(map, WEATHER_SOURCE_ID, WEATHER_LAYER_ID, weatherUrl, clamp01(weatherOpacity));
    } else {
      removeLayerAndSource(map, WEATHER_LAYER_ID, WEATHER_SOURCE_ID);
    }
    syncOverlayOrder(map);
  }

  function syncFlood(map: mapboxgl.Map) {
    if (floodOn) {
      const floodUrl =
        "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100" +
        "?service=WMS&request=GetMap&version=1.3.0" +
        "&layers=NZ.RiskZone&styles=" +
        "&format=image/png&transparent=true" +
        "&height=256&width=256&crs=EPSG:3857" +
        "&bbox={bbox-epsg-3857}";
      addRasterLayer(map, FLOOD_SOURCE_ID, FLOOD_LAYER_ID, floodUrl, 0.65);
    } else {
      removeLayerAndSource(map, FLOOD_LAYER_ID, FLOOD_SOURCE_ID);
    }
    syncOverlayOrder(map);
  }

  function syncEfas(map: mapboxgl.Map) {
    if (efasOn && efasLayer) {
      const timeParam = efasTime ? `&time=${encodeURIComponent(efasTime)}` : "";
      const cacheBust = encodeURIComponent(`${efasLayer}-${efasTime ?? "notime"}`);
      const efasUrl =
        "https://european-flood.emergency.copernicus.eu/api/wms/" +
        "?service=WMS&request=GetMap&version=1.3.0" +
        `&layers=${encodeURIComponent(efasLayer)}&styles=` +
        "&format=image/png&transparent=true" +
        "&height=256&width=256&crs=EPSG:3857" +
        "&bbox={bbox-epsg-3857}" +
        timeParam +
        `&_ts=${cacheBust}`;

      addRasterLayer(map, EFAS_SOURCE_ID, EFAS_LAYER_ID, efasUrl, clamp01(efasOpacity));
    } else {
      removeLayerAndSource(map, EFAS_LAYER_ID, EFAS_SOURCE_ID);
    }
    syncOverlayOrder(map);
  }

  function applyTerrain(map: mapboxgl.Map) {
    if (terrain3d) {
      if (!map.getSource(TERRAIN_SOURCE_ID)) {
        map.addSource(TERRAIN_SOURCE_ID, {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      }

      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.1 });
      map.easeTo({ pitch: 45, bearing: -10, duration: 700 });
    } else {
      map.setTerrain(null);
      if (map.getLayer(BUILDINGS_LAYER_ID)) map.removeLayer(BUILDINGS_LAYER_ID);
      if (map.getSource(TERRAIN_SOURCE_ID)) map.removeSource(TERRAIN_SOURCE_ID);
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }

  function ensureBuildingsLayer(map: mapboxgl.Map): boolean {
    if (map.getLayer(BUILDINGS_LAYER_ID)) return true;
    if (!map.getSource("composite") || !map.isSourceLoaded("composite")) return false;

    const layers = map.getStyle().layers || [];
    if (!layers.length) return false;

    const labelLayerId = layers.find(
      (l) => l.type === "symbol" && (l.layout as any)?.["text-field"]
    )?.id;

    try {
      map.addLayer(
        {
          id: BUILDINGS_LAYER_ID,
          source: "composite",
          "source-layer": "building",
          filter: [">", ["get", "height"], 0],
          type: "fill-extrusion",
          minzoom: 15,
          layout: {
            visibility: "none",
          },
          paint: {
            "fill-extrusion-color": "#8b8f97",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId
      );
      return true;
    } catch {
      // If the style doesn't include the composite source, skip buildings.
      return false;
    }
  }

  function syncBuildings(map: mapboxgl.Map, visible: boolean) {
    if (!visible) {
      if (map.getLayer(BUILDINGS_LAYER_ID)) {
        map.setLayoutProperty(BUILDINGS_LAYER_ID, "visibility", "none");
      }
      return;
    }

    if (!ensureBuildingsLayer(map)) return;

    if (map.getLayer(BUILDINGS_LAYER_ID)) {
      map.setLayoutProperty(BUILDINGS_LAYER_ID, "visibility", "visible");
    }
  }

  function syncMarker(map: mapboxgl.Map, next: LatLon | null | undefined) {
    if (!next) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      popupRef.current = null;
      return;
    }

    const lngLat: [number, number] = [next.lon, next.lat];

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: "#e11d48" }).setLngLat(lngLat);
      popupRef.current = new mapboxgl.Popup({ offset: 20 }).setHTML(
        `<div class="text-sm">` +
          `<div><b>Coordenadas</b></div>` +
          `<div>lat: ${next.lat.toFixed(6)}</div>` +
          `<div>lon: ${next.lon.toFixed(6)}</div>` +
          `</div>`
      );
      markerRef.current.setPopup(popupRef.current).addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
      if (popupRef.current) {
        popupRef.current.setHTML(
          `<div class="text-sm">` +
            `<div><b>Coordenadas</b></div>` +
            `<div>lat: ${next.lat.toFixed(6)}</div>` +
            `<div>lon: ${next.lon.toFixed(6)}</div>` +
            `</div>`
        );
      }
    }
  }

  function clamp01(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAPBOX_STYLES[baseLayer],
      center,
      zoom: value ? 14 : 6,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("click", (e) => {
      onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    map.on("load", () => {
      syncWeather(map);
      syncFlood(map);
      syncEfas(map);
      applyTerrain(map);
      syncBuildings(map, terrain3d);
      syncMarker(map, value ?? null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextStyle = MAPBOX_STYLES[baseLayer];
    map.setStyle(nextStyle);
    map.once("style.load", () => {
      syncWeather(map);
      syncFlood(map);
      syncEfas(map);
      applyTerrain(map);
      syncBuildings(map, terrain3d);
    });
  }, [baseLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    runWhenStyleReady(map, () => syncWeather(map));
  }, [weatherLayer, weatherOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    runWhenStyleReady(map, () => syncFlood(map));
  }, [floodOn]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    runWhenStyleReady(map, () => syncEfas(map));
  }, [efasOn, efasLayer, efasOpacity, efasTime]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    runWhenStyleReady(map, () => applyTerrain(map));
  }, [terrain3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    runWhenStyleReady(map, () => {
      if (!terrain3d) {
        syncBuildings(map, false);
        return;
      }

      let tries = 0;
      const maxTries = 60;
      const trySync = () => {
        syncBuildings(map, true);
        tries += 1;
        if (map.getLayer(BUILDINGS_LAYER_ID) && map.getLayoutProperty(BUILDINGS_LAYER_ID, "visibility") === "visible") {
          return;
        }
        if (tries >= maxTries) return;
        requestAnimationFrame(trySync);
      };

      runWhenCompositeReady(map, trySync);
      map.once("idle", trySync);
      trySync();
    });
  }, [terrain3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    syncMarker(map, value ?? null);

    if (value) {
      map.flyTo({
        center: [value.lon, value.lat],
        zoom: 14,
        speed: 1.1,
        curve: 1.4,
        essential: true,
      });
    } else {
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: 6,
        speed: 1.1,
        curve: 1.4,
        essential: true,
      });
    }
  }, [value]);

  if (!mapboxToken) {
    return (
      <div className="relative flex h-full min-h-screen w-full items-center justify-center overflow-hidden">
        <div className="rounded-xl border bg-background/90 px-4 py-3 text-sm shadow">
          Configura NEXT_PUBLIC_MAPBOX_TOKEN para usar el mapa.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden">
      {overlay ? <div className="absolute right-3 top-30 z-[1200]">{overlay}</div> : null}
      {bottomLeftOverlay ? (
        <div className="absolute bottom-4 left-1/2 z-[1200] -translate-x-1/2 transform">
          {bottomLeftOverlay}
        </div>
      ) : null}

      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  );
}
