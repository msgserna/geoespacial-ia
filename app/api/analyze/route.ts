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

type EfasCheck = {
  inside: boolean;
  featureCount: number;
  layer?: string;
  time?: string | null;
};

type AirQuality = {
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
};

type SourcesMap = Record<string, { name: string; url: string; note?: string }>;

function riskFrom(inside: boolean, rain1hMm: number | null) {
  if (!inside) return { level: "Bajo" as const, reason: "Fuera de Q100" };
  if (rain1hMm == null) return { level: "Medio" as const, reason: "En Q100, sin dato lluvia 1h" };
  if (rain1hMm < 1) return { level: "Medio" as const, reason: "En Q100, lluvia débil" };
  if (rain1hMm < 5) return { level: "Alto" as const, reason: "En Q100, lluvia moderada" };
  return { level: "Muy alto" as const, reason: "En Q100, lluvia intensa" };
}

function asNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildMapImageUrl(lat: number, lon: number) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const style = "mapbox/streets-v12";
  const marker = `pin-l+0f766e(${lon},${lat})`;
  const center = `${lon},${lat},14,0`;
  const size = "800x420";

  return `https://api.mapbox.com/styles/v1/${style}/static/${marker}/${center}/${size}?access_token=${encodeURIComponent(
    token
  )}`;
}

function cleanReportText(text: string) {
  return text
    .replace(/^\s*#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)")
    .trim();
}

function snippet(s: string, n = 240) {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, n);
}

function looksLikeEmptyFeatureInfo(text: string) {
  const t = (text || "").toLowerCase();
  return (
    t.includes("no features were found") ||
    t.includes("no features") ||
    t.includes("feature count: 0") ||
    t.includes("featurecount=0") ||
    t.includes("sin resultados") ||
    t.includes("no hay resultados")
  );
}

async function tryFetch(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,text/html,*/*",
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  return { res, contentType, text };
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
  const endpoints = [
    process.env.OVERPASS_URL || "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];
  const ua = process.env.NOMINATIM_USER_AGENT || "map-ia/1.0 (contact: example@example.com)";

  async function runQuery(radius: number, filters: string[]) {
    const query = `
[out:json][timeout:45];
(
${filters
  .map((f) => `  node(around:${radius},${lat},${lon})["${f}"];`)
  .join("\n")}
);
out center 60;
`;

    let lastError: string | null = null;
    let json: any = null;

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=UTF-8",
            "User-Agent": ua,
          },
          body: query,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          lastError = `Overpass error: ${res.status}`;
          console.error("Overpass error", { url, status: res.status, body: text.slice(0, 300) });
          continue;
        }

        json = await res.json().catch(() => null);
        if (json) return { json, url };
      } catch (e: any) {
        lastError = e?.name === "AbortError" ? "Overpass timeout" : e?.message || "Overpass error";
        console.error("Overpass error", { url, error: lastError });
      }
    }

    throw new Error(lastError || "Overpass error");
  }

  // Intento completo (más pesado)
  let payload: { json: any; url: string } | null = null;
  let radius = 800;
  let partial = false;

  try {
    payload = await runQuery(radius, [
      "amenity",
      "highway",
      "railway",
      "public_transport",
      "shop",
      "tourism",
      "building",
    ]);
  } catch {
    // Fallback ligero (menos carga)
    radius = 500;
    partial = true;
    payload = await runQuery(radius, ["amenity", "highway", "public_transport", "railway"]);
  }

  const elements: any[] = Array.isArray(payload?.json?.elements) ? payload.json.elements : [];
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

  return { radiusMeters: radius, total: elements.length, counts, partial, sourceUrl: payload?.url };
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

  const infoFormats = [
    "application/json",
    "application/geo+json",
    "application/geojson",
    "text/plain",
    "text/html",
  ];

  const attempts: Array<{ name: string; url: string }> = [];

  for (const fmt of infoFormats) {
    attempts.push({
      name: `1.3.0 ${fmt}`,
      url:
        `${WMS_URL}?service=WMS&request=GetFeatureInfo&version=1.3.0` +
        `&crs=EPSG:4326` +
        `&bbox=${encodeURIComponent(`${minLat},${minLon},${maxLat},${maxLon}`)}` +
        `&width=${width}&height=${height}` +
        `&layers=${encodeURIComponent(LAYER)}` +
        `&query_layers=${encodeURIComponent(LAYER)}` +
        `&styles=` +
        `&format=${encodeURIComponent("image/png")}` +
        `&info_format=${encodeURIComponent(fmt)}` +
        `&i=${i}&j=${j}`,
    });

    attempts.push({
      name: `1.1.1 ${fmt}`,
      url:
        `${WMS_URL}?service=WMS&request=GetFeatureInfo&version=1.1.1` +
        `&srs=EPSG:4326` +
        `&bbox=${encodeURIComponent(`${minLon},${minLat},${maxLon},${maxLat}`)}` +
        `&width=${width}&height=${height}` +
        `&layers=${encodeURIComponent(LAYER)}` +
        `&query_layers=${encodeURIComponent(LAYER)}` +
        `&styles=` +
        `&format=${encodeURIComponent("image/png")}` +
        `&info_format=${encodeURIComponent(fmt)}` +
        `&x=${i}&y=${j}`,
    });
  }

  for (const a of attempts) {
    try {
      const { res, contentType, text } = await tryFetch(a.url);
      if (!res.ok) continue;

      if (contentType.includes("json")) {
        try {
          const json: any = JSON.parse(text);
          const features = Array.isArray(json?.features) ? json.features : [];
          return { inside: features.length > 0, featureCount: features.length };
        } catch {
          continue;
        }
      }

      const empty = looksLikeEmptyFeatureInfo(text);
      const inside = !empty && text.trim().length > 0;
      return { inside, featureCount: inside ? 1 : 0 };
    } catch {
      continue;
    }
  }

  throw new Error("No se pudo consultar Q100 (GetFeatureInfo) con formatos compatibles");
}

async function efasGetFeatureInfo(lat: number, lon: number, layer: string, time?: string | null) {
  const WMS_URL = "https://european-flood.emergency.copernicus.eu/api/wms/";
  const width = 256;
  const height = 256;
  const i = 128;
  const j = 128;

  const toWebMercator = (latIn: number, lonIn: number) => {
    const x = (lonIn * 20037508.34) / 180;
    const y =
      (Math.log(Math.tan(((90 + latIn) * Math.PI) / 360)) / (Math.PI / 180)) *
      (20037508.34 / 180);
    return { x, y };
  };

  const { x, y } = toWebMercator(lat, lon);
  const d = 120;
  const minX = x - d;
  const minY = y - d;
  const maxX = x + d;
  const maxY = y + d;

  const url =
    `${WMS_URL}?service=WMS&request=GetFeatureInfo&version=1.1.1` +
    `&srs=EPSG:3857` +
    `&bbox=${encodeURIComponent(`${minX},${minY},${maxX},${maxY}`)}` +
    `&width=${width}&height=${height}` +
    `&layers=${encodeURIComponent(layer)}` +
    `&query_layers=${encodeURIComponent(layer)}` +
    `&info_format=${encodeURIComponent("application/json")}` +
    `&x=${i}&y=${j}` +
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
  )}&units=metric&lang=es&appid=${encodeURIComponent(key)}`;

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

async function calidadAire(lat: number, lon: number): Promise<AirQuality> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return { aqi: null, pm2_5: null, pm10: null, no2: null, o3: null };
  }

  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${encodeURIComponent(
    String(lat)
  )}&lon=${encodeURIComponent(String(lon))}&appid=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeather air pollution error: ${res.status}`);

  const data: any = await res.json();
  const item = Array.isArray(data?.list) ? data.list[0] : null;

  return {
    aqi: typeof item?.main?.aqi === "number" ? item.main.aqi : null,
    pm2_5: typeof item?.components?.pm2_5 === "number" ? item.components.pm2_5 : null,
    pm10: typeof item?.components?.pm10 === "number" ? item.components.pm10 : null,
    no2: typeof item?.components?.no2 === "number" ? item.components.no2 : null,
    o3: typeof item?.components?.o3 === "number" ? item.components.o3 : null,
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
    const floodOn = body?.floodOn === true;
    const efasOn = body?.efasOn === true;
    const efasLayerIn = typeof body?.efasLayer === "string" ? body.efasLayer.trim() : "";
    const efasTimeIn = typeof body?.efasTime === "string" ? body.efasTime.trim() : null;

    let coords: { lat: number; lon: number; label?: string } | null = null;

    // 1) Coordenadas
    if (latIn !== null && lonIn !== null) {
      coords = { lat: latIn, lon: lonIn, label: address || undefined };
      // Si no hay address pero si coords, intenta reverse geocode para dar contexto al informe.
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
    if (urban?.sourceUrl) {
      sources.overpass = {
        name: "OpenStreetMap Overpass API (infraestructura/POIs)",
        url: urban.sourceUrl,
      };
    }
    if (urban?.partial) {
      limitations.push("Infraestructura parcial por limitaciones de Overpass.");
    }
    } catch {
      urban = null;
      limitations.push("No se pudo obtener infraestructura cercana (Overpass).");
    }

    // 3) Meteo + calidad del aire (OpenWeather)
    let meteo: WeatherNow | null = null;
    let air: AirQuality | null = null;
    try {
      meteo = await meteoActual(lat, lon);
      sources.openweather = {
        name: "OpenWeather Current (data/2.5/weather)",
        url: "https://openweathermap.org/current",
      };
    } catch {
      meteo = null;
      limitations.push("No se pudo obtener meteorologia actual (OpenWeather).");
    }

    try {
      air = await calidadAire(lat, lon);
      sources.openweather_air = {
        name: "OpenWeather Air Pollution (data/2.5/air_pollution)",
        url: "https://openweathermap.org/api/air-pollution",
      };
    } catch {
      air = null;
      limitations.push("No se pudo obtener contaminacion del aire (OpenWeather).");
    }

    // 4) Q100 (WMS GetFeatureInfo)
    let floodQ100: FloodQ100Check | null = null;
  if (floodOn) {
    try {
      floodQ100 = await floodQ100GetFeatureInfo(lat, lon);
      sources.floodWms = {
        name: "MITECO/SNCZI WMS ZI_LaminasQ100 (NZ.RiskZone) GetFeatureInfo",
        url: "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100",
      };
    } catch {
      floodQ100 = null;
      limitations.push("No se pudo consultar la capa Q100 (WMS GetFeatureInfo).");
      sources.floodWms = {
        name: "MITECO/SNCZI WMS ZI_LaminasQ100 (NZ.RiskZone) GetFeatureInfo",
        url: "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100",
      };
    }
  }

    // 5) Riesgo dinamico
    const dynamicFloodRisk =
      floodQ100 && meteo ? riskFrom(floodQ100.inside, meteo.rain1hMm) : null;

    // 6) EFAS (usar la capa activa en el mapa si esta disponible)
    const efasLayerEnv = process.env.EFAS_LAYER_DEFAULT;
    const efasTimeEnv = process.env.EFAS_TIME_DEFAULT || null;
    let efas: EfasCheck | null = null;
    const efasLayerFinal =
      efasOn && efasLayerIn
        ? efasLayerIn
        : efasOn && efasLayerEnv && efasLayerEnv !== "__AUTO__"
          ? efasLayerEnv
          : "";
    const efasTimeFinal = efasOn ? efasTimeIn || efasTimeEnv : null;

  if (efasOn && efasLayerFinal) {
    try {
      efas = await efasGetFeatureInfo(lat, lon, efasLayerFinal, efasTimeFinal);
      sources.efas = {
        name: `Copernicus EFAS (${efasLayerFinal})`,
        url: "https://european-flood.emergency.copernicus.eu/",
      };
    } catch {
      efas = null;
      limitations.push("No se pudo consultar la capa EFAS (Copernicus).");
      sources.efas = {
        name: `Copernicus EFAS (${efasLayerFinal})`,
        url: "https://european-flood.emergency.copernicus.eu/",
      };
    }
  } else if (efasOn && !efasLayerFinal) {
    limitations.push("EFAS activo pero sin capa seleccionada.");
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
        mapImageUrl: buildMapImageUrl(lat, lon),
        layers: {
          floodOn,
          efasOn,
          efasLayer: efasOn ? efasLayerFinal || null : null,
          efasTime: efasOn ? efasTimeFinal || null : null,
        },
        urban,
        meteo,
        air,
        floodQ100,
        dynamicFloodRisk,
        efas,
        sources,
        limitations,
      };

      const prompt = `
Eres un analista geoespacial. Redacta un informe conciso y profesional SOLO con los datos del JSON.

Formato estricto:
- No uses Markdown (sin #, sin **, sin listas con guiones).
- Usa texto plano con numeracion "1.", "2.", etc.
- Si falta un dato, escribe "LIMITACION: <motivo>".
- Q100 (MITECO) es riesgo estadistico (T=100 anos). No afirmes inundacion activa.
- Si EFAS no esta activada (layers.efasOn = false), omite esa linea por completo.
- En cada seccion redacta 2-4 frases con analisis breve (conclusiones prudentes) basadas en los datos; no solo enumeres.
- El titulo de cada seccion debe ir en su propia linea con ":" al final. El contenido va en lineas separadas debajo.
- En Infraestructura cercana evita listar cada categoria en lineas separadas; resume en 1-2 frases con las categorias clave.

Secciones obligatorias, en este orden:
1. Descripcion de la zona (usa label si existe; si no, coords)
2. Infraestructura cercana (resumen de urban: total y categorias clave) y un breve analisis del tipo de actividad urbana.
3. Riesgos relevantes:
   MITECO (Q100): si inside=false, escribe "No se detecta interseccion con zona Q100"; si inside=true, indica que el punto cae en zona Q100.
   EFAS (solo si layers.efasOn=true): si inside=false, escribe "No se detecta interseccion con la capa EFAS seleccionada"; si inside=true, indica que el punto cae en la capa.
   Riesgo dinamico (dynamicFloodRisk o LIMITACION) y una frase de interpretacion.
   Meteo actual: escribe cada dato en su propia linea (Temperatura, Lluvia 1h, Viento, Descripcion) y despues 2 frases de interpretacion.
   Contaminacion del aire: escribe cada dato en su propia linea (AQI, PM2.5, PM10, NO2, O3) o LIMITACION y despues 2 frases de interpretacion.
   Si lluvia 1h no esta disponible, escribe "No se preven lluvias".
4. Posibles usos urbanos (prudentes) con 2-3 frases justificadas por los datos.
5. Recomendacion final (sintetica, 2-3 frases)
6. Fuentes y limitaciones (lista breve)

Datos (JSON):
${JSON.stringify(payloadForModel, null, 2)}
`.trim();

      const resp = await client.responses.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: prompt,
      });

      report = cleanReportText(resp.output_text || "");
      if (!efasOn) {
        report = report
          .replace(/^\s*EFAS\s*:\s*.*$/gim, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
    }

    const endedAt = Date.now();

    return NextResponse.json(
      {
        ok: true,
        coords: { lat, lon, label: coords.label ?? null },
        mapImageUrl: buildMapImageUrl(lat, lon),
        layers: {
          floodOn,
          efasOn,
          efasLayer: efasOn ? efasLayerFinal || null : null,
          efasTime: efasOn ? efasTimeFinal || null : null,
        },
        urban,
        meteo,
        air,
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

