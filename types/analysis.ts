export type LatLon = { lat: number; lon: number };

export type SourceRef = {
  name: string;
  url: string;
  note?: string;
};

export type ToolResult<T> = {
  ok: boolean;
  data?: T;
  source?: SourceRef;
  limitations?: string[];
  error?: string;
};

export type GeocodeData = {
  query: string;
  lat: number;
  lon: number;
  display_name: string;
  provider: "OpenStreetMap Nominatim";
};

export type UrbanismData = {
  radius_m: number;
  counts: Record<string, number>;
  topAmenities: Array<{ amenity: string; count: number }>;
  transport: {
    bus_stops: number;
    stations: number;
  };
  roads: Array<{ highway: string; count: number }>;
  parks: number;
  rawSample: Array<{
    type: string;
    tags?: Record<string, string>;
    center?: { lat: number; lon: number };
  }>;
};

/**
 * Meteo puntual para el punto seleccionado (datos reales, no tiles).
 * Usado para UI (mini-card) y para incluir en el informe IA.
 */
export type WeatherData = {
  lat: number;
  lon: number;
  provider: "OpenWeather";

  tempC: number | null;
  windMs: number | null;
  cloudsPct: number | null;
  humidityPct: number | null;

  rain1hMm: number | null;
  rain3hMm: number | null;

  description: string | null;
  icon?: string | null;
  dt?: number | null;
};

/**
 * Heurística explicable: combina pertenencia a Q100 + precipitación real.
 * No es una predicción oficial de inundación activa.
 */
export type DynamicFloodRisk = {
  level: "Bajo" | "Medio" | "Alto" | "Muy alto";
  reason: string;
  basis: {
    insideQ100: boolean;
    rain1hMm: number | null;
  };
};

export type FloodData = {
  wms_url: string;
  layer_used?: string;

  /**
   * Interpretación de GetFeatureInfo:
   * true => punto dentro de zona inundable Q100
   * false => fuera
   */
  insideQ100?: boolean;
  featureCount?: number;

  /**
   * Riesgo dinámico (Q100 + lluvia real).
   * Idealmente calculado en /api/analyze para que salga en el informe IA.
   */
  dynamicRisk?: DynamicFloodRisk;

  featureInfo?: unknown;
  rawTextSnippet?: string;

  note: string;
};

export type AnalysisResponse = {
  coords: { lat: number; lon: number; label?: string };
  data: {
    geocode?: ToolResult<GeocodeData>;
    urban: ToolResult<UrbanismData>;
    flood: ToolResult<FloodData>;

    // ✅ NUEVO
    weather?: ToolResult<WeatherData>;
  };
  report: string;
  sources: SourceRef[];
  limitations: string[];
};
