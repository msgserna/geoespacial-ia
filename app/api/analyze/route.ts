import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type LatLon = { lat: number; lon: number };

type WeatherNow = {
  tempC: number | null;
  windMs: number | null;
  cloudsPct: number | null;
  humidityPct: number | null;
  rain1hMm: number | null;
  rain3hMm: number | null;
  description: string | null;
};

type FloodQ100Check = {
  inside: boolean;
  featureCount: number;
};

type SourcesMap = Record<string, { name: string; url: string; note?: string }>;

function riskFrom(inside: boolean, rain1hMm: number | null) {
  if (!inside) return { level: "Bajo" as const, reason: "Fuera de Q100" };
  if (rain1hMm == null) return { level: "Medio" as const, reason: "En Q100, sin dato lluvia 1h" };
  if (rain1hMm < 1) return { level: "Medio" as const, reason: "En Q100, lluvia debil" };
  if (rain1hMm < 5) return { level: "Alto" as const, reason: "En Q100, lluvia moderada" };
  return { level: "Muy alto" as const, reason: "En Q100, lluvia intensa" };
}

function asNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function buscarCoordenadas(address: string) {
  const ua = process.env.NOMINATIM_USER_AGENT || "map-ia/1.0 (contact: example@example.com)";
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    address
  )}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": ua,
      "Accept-Language": "es",
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data: any[] = await res.json();
  if (!data?.length) throw new Error("No se encontraron coordenadas para la dirección.");

  const item = data[0];
  const lat = asNum(item?.lat);
  const lon = asNum(item?.lon);
  if (lat === null || lon === null) throw new Error("Respuesta inválida de Nominatim.");

  return { lat, lon, label: item?.display_name ?? address };
}

async function reverseGeocode(lat: number, lon: number) {
  const ua = process.env.NOMINATIM_USER_AGENT || "map-ia/1.0 (contact: example@example.com)";
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&lat=${encodeURIComponent(
    String(lat)
  )}&lon=${encodeURIComponent(String(lon))}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": ua,
      "Accept-Language": "es",
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`Nominatim reverse error: ${res.status}`);
  const data: any = await res.json().catch(() => ({}));
  const label = typeof data?.display_name === "string" ? data.display_name : null;
  return { label };
}

async function capasUrbanismo(lat: number, lon: number) {
  // Infraestructura cercana con Overpass (radio ~800m)
  const radius = 800;

  const query = `
[out:json][timeout:25];
(
  node(around:${radius},${lat},${lon})["amenity"];
  node(around:${radius},${lat},${lon})["highway"];
  node(around:${radius},${lat},${lon})["railway"];
  node(around:${radius},${lat},${lon})["public_transport"];
  node(around:${radius},${lat},${lon})["shop"];
  node(around:${radius},${lat},${lon})["tourism"];
  node(around:${radius},${lat},${lon})["building"];
);
out center 60;
`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: query,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json: any = await res.json();

  // Resumen simple por categorías (para el informe)
  const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];
  const counts: Record<string, number> = {};

  for (const el of elements) {
    const tags = el?.tags ?? {};
    const key =
      tags.amenity
        ? `amenity:${tags.amenity}`
        : tags.highway
          ? `highway:${tags.highway}`
          : tags.railway
            ? `railway:${tags.railway}`
            : tags.public_transport
              ? `public_transport:${tags.public_transport}`
              : tags.shop
                ? `shop:${tags.shop}`
                : tags.tourism
                  ? `tourism:${tags.tourism}`
                  : tags.building
                    ? `building:${tags.building}`
                    : "other";

    counts[key] = (counts[key] ?? 0) + 1;
  }

  return { radiusMeters: radius, total: elements.length, counts };
}

async function floodQ100GetFeatureInfo(lat: number, lon: number): Promise<FloodQ100Check> {
  const WMS_URL = "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100";
  const LAYER = "NZ.RiskZone";

  const d = 0.0007;
  const minLat = lat - d;
  const minLon = lon - d;
  const maxLat = lat + d;
  const maxLon = lon + d;

  const width = 256;
  const height = 256;
  const i = 128;
  const j = 128;

  const url =
    `${WMS_URL}?service=WMS&request=GetFeatureInfo&version=1.3.0` +
    `&crs=EPSG:4326` +
    `&bbox=${encodeURIComponent(`${minLat},${minLon},${maxLat},${maxLon}`)}` +
    `&width=${width}&height=${height}` +
    `&layers=${encodeURIComponent(LAYER)}` +
    `&query_layers=${encodeURIComponent(LAYER)}` +
    `&info_format=${encodeURIComponent("application/json")}` +
    `&i=${i}&j=${j}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`WMS GetFeatureInfo error: ${res.status}`);

  const json: any = await res.json().catch(() => null);
  const features = Array.isArray(json?.features) ? json.features : [];
  return { inside: features.length > 0, featureCount: features.length };
}

async function efasGetFeatureInfo(lat: number, lon: number, layer: string, time?: string | null) {
  const WMS_URL = "https://european-flood.emergency.copernicus.eu/api/wms/";
  const d = 0.0007;
  const minLat = lat - d;
  const minLon = lon - d;
  const maxLat = lat + d;
  const maxLon = lon + d;
  const width = 256;
  const height = 256;
  const i = 128;
  const j = 128;

  const url =
    `${WMS_URL}?service=WMS&request=GetFeatureInfo&version=1.3.0` +
    `&crs=EPSG:4326` +
    `&bbox=${encodeURIComponent(`${minLat},${minLon},${maxLat},${maxLon}`)}` +
    `&width=${width}&height=${height}` +
    `&layers=${encodeURIComponent(layer)}` +
    `&query_layers=${encodeURIComponent(layer)}` +
    `&info_format=${encodeURIComponent("application/json")}` +
    `&i=${i}&j=${j}` +
    (time ? `&time=${encodeURIComponent(time)}` : "");

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`EFAS GetFeatureInfo error: ${res.status}`);

  const json: any = await res.json().catch(() => null);
  const features = Array.isArray(json?.features) ? json.features : [];
  return { inside: features.length > 0, featureCount: features.length, layer, time };
}

async function meteoActual(lat: number, lon: number): Promise<WeatherNow> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return {
      tempC: null,
      windMs: null,
      cloudsPct: null,
      humidityPct: null,
      rain1hMm: null,
      rain3hMm: null,
      description: null,
    };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
    String(lat)
  )}&lon=${encodeURIComponent(
    String(lon)
  )}&units=metric&appid=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather current error: ${res.status}`);

  const data: any = await res.json();

  return {
    tempC: data?.main?.temp ?? null,
    windMs: data?.wind?.speed ?? null,
    cloudsPct: data?.clouds?.all ?? null,
    humidityPct: data?.main?.humidity ?? null,
    rain1hMm: data?.rain?.["1h"] ?? null,
    rain3hMm: data?.rain?.["3h"] ?? null,
    description: data?.weather?.[0]?.description ?? null,
  };
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const limitations: string[] = [];
  const sources: SourcesMap = {};

  try {
    const body = await req.json().catch(() => ({}));
    const address = typeof body?.address === "string" ? body.address.trim() : "";
    const latIn = asNum(body?.lat);
    const lonIn = asNum(body?.lon);

    let coords: { lat: number; lon: number; label?: string } | null = null;

    // 1) Coordenadas
    if (latIn !== null && lonIn !== null) {
      coords = { lat: latIn, lon: lonIn, label: address || undefined };
      // Si no hay address pero sí coords, intenta reverse geocode para dar contexto al informe.
      try {
        const rev = await reverseGeocode(latIn, lonIn);
        if (rev?.label) {
          coords.label = rev.label;
          sources.nominatim_reverse = {
            name: "OpenStreetMap Nominatim (reverse geocoding)",
            url: "https://nominatim.openstreetmap.org/",
          };
        }
      } catch {
        limitations.push("No se pudo obtener nombre de localidad (reverse geocode).");
      }
    } else if (address) {
      const geo = await buscarCoordenadas(address);
      coords = { lat: geo.lat, lon: geo.lon, label: geo.label };
      sources.nominatim = {
        name: "OpenStreetMap Nominatim (geocoding)",
        url: "https://nominatim.openstreetmap.org/",
      };
    } else {
      return NextResponse.json(
        { error: "Debes enviar address o (lat, lon)." },
        { status: 400 }
      );
    }

    const lat = coords.lat;
    const lon = coords.lon;

  // 2) Infra (OSM Overpass)
  let urban: any = null;
  try {
    urban = await capasUrbanismo(lat, lon);
    sources.overpass = {
      name: "OpenStreetMap Overpass API (infraestructura/POIs)",
      url: "https://overpass-api.de/api/interpreter",
    };
  } catch {
    urban = null;
    limitations.push("No se pudo obtener infraestructura cercana (Overpass).");
  }

  // 3) Meteo (OpenWeather)
  let meteo: WeatherNow | null = null;
  try {
    meteo = await meteoActual(lat, lon);
    sources.openweather = {
      name: "OpenWeather Current (data/2.5/weather)",
      url: "https://openweathermap.org/current",
    };
  } catch {
    meteo = null;
    limitations.push("No se pudo obtener meteorología actual (OpenWeather).");
  }

  // 4) Q100 (WMS GetFeatureInfo)
  let floodQ100: FloodQ100Check | null = null;
  try {
    floodQ100 = await floodQ100GetFeatureInfo(lat, lon);
    sources.floodWms = {
      name: "MITECO/SNCZI WMS ZI_LaminasQ100 (NZ.RiskZone) GetFeatureInfo",
      url: "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100",
    };
  } catch {
    floodQ100 = null;
    limitations.push("No se pudo consultar la capa Q100 (WMS GetFeatureInfo).");
  }

  // 5) Riesgo dinámico
  const dynamicFloodRisk =
    floodQ100 && meteo ? riskFrom(floodQ100.inside, meteo.rain1hMm) : null;

  // 6) EFAS (opcional, si se configura una capa por defecto)
  const efasLayerEnv = process.env.EFAS_LAYER_DEFAULT;
  const efasTimeEnv = process.env.EFAS_TIME_DEFAULT || null;
  let efas: EfasCheck | null = null;
  if (efasLayerEnv) {
    try {
      efas = await efasGetFeatureInfo(lat, lon, efasLayerEnv, efasTimeEnv);
      sources.efas = {
        name: `Copernicus EFAS (${efasLayerEnv})`,
        url: "https://european-flood.emergency.copernicus.eu/",
      };
    } catch {
      efas = null;
      limitations.push("No se pudo consultar la capa EFAS (Copernicus).");
    }
  } else {
    limitations.push("EFAS no configurado (añade EFAS_LAYER_DEFAULT en .env).");
  }

  // 6) Informe IA
  const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      limitations.push("Falta OPENAI_API_KEY: no se pudo generar el informe IA.");
    }

    let report = "";
    if (openaiKey) {
      const client = new OpenAI({ apiKey: openaiKey });

      const payloadForModel = {
        coords: { lat, lon, label: coords.label ?? null },
        urban,
        meteo,
        floodQ100,
        dynamicFloodRisk,
        efas,
        sources,
        limitations,
      };

      const prompt = `
Eres un analista geoespacial. Redacta un informe conciso y profesional SOLO con los datos del JSON.

Instrucciones estrictas:
- NO inventes ni alucines. Si falta un dato, dilo como LIMITACIÓN.
- Q100 es riesgo estadístico (T=100 años). No afirmes inundación activa.
- Incluye SIEMPRE estas secciones, en este orden:
  1) Descripción de la zona (usa label si existe; si no, coords)
  2) Infraestructura cercana (resumen de urban: total y categorías clave)
  3) Riesgos relevantes:
     - Q100 (floodQ100: inside/featureCount o LIMITACIÓN)
     - EFAS (efas: inside/featureCount o LIMITACIÓN)
     - Riesgo dinámico (dynamicFloodRisk o LIMITACIÓN)
     - Meteo actual (meteo: temp, lluvia 1h, viento) o LIMITACIÓN
  4) Posibles usos urbanos (prudentes)
  5) Recomendación final (sintética)
  6) Fuentes y limitaciones (lista)
- Si hay fuentes, cita nombre y URL cuando esté disponible.

Datos (JSON):
${JSON.stringify(payloadForModel, null, 2)}
`.trim();

      const resp = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: prompt,
      });

      report = resp.output_text || "";
    }

    const endedAt = Date.now();

    return NextResponse.json(
      {
        ok: true,
        coords: { lat, lon, label: coords.label ?? null },
        urban,
        meteo,
        floodQ100,
        dynamicFloodRisk,
        efas,
        sources,
        limitations,
        report,
        meta: {
          ms: endedAt - startedAt,
          at: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error en /api/analyze", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
