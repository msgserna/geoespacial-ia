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

export type FloodData = {
  wms_url: string;
  layer_used?: string;
  featureInfo?: unknown;
  rawTextSnippet?: string;
  note: string;
};

export type DynamicFloodRisk = { level: string; reason: string };

// --- NUEVO: Copernicus EFAS ---
export type EfasLayerInfo = {
  name: string;
  title?: string;
  abstract?: string;
  queryable?: boolean;
};

export type EfasData = {
  wms_url: string;
  layer_used?: string;
  layer_title?: string;
  inside: boolean;
  featureCount?: number;
  rawTextSnippet?: string;
  note: string;
};

export type AnalysisResponse = {
  // Coordenadas
  coords: { lat: number; lon: number; label?: string | null };
  mapImageUrl?: string;

  // Bloque estructurado que consumen los paneles (permite rellenar compatibilidad en cliente)
  data?: {
    geocode?: ToolResult<GeocodeData | Record<string, unknown>>;
    urban?: ToolResult<UrbanismData | Record<string, unknown>>;
    flood?: ToolResult<FloodData | Record<string, unknown>>;
    efas?: ToolResult<EfasData | Record<string, unknown>>;
    meteo?: ToolResult<Record<string, unknown>>;
    dynamicFloodRisk?: ToolResult<DynamicFloodRisk>;
  };

  // Campos tal como salen del API /api/analyze (sin normalizar)
  ok?: boolean;
  urban?: unknown;
  meteo?: unknown;
  floodQ100?: unknown;
  dynamicFloodRisk?: DynamicFloodRisk | null;
  efas?: unknown;
  air?: unknown;
  layers?: {
    floodOn?: boolean;
    efasOn?: boolean;
    efasLayer?: string | null;
    efasTime?: string | null;
  };

  report: string;
  sources: SourceRef[] | Record<string, any>;
  limitations: string[];
  meta?: { ms: number; at: string };
};
