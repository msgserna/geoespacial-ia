import { NextResponse } from "next/server";

export const runtime = "nodejs";

function num(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = num(searchParams.get("lat"));
  const lon = num(searchParams.get("lon"));

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "lat/lon inválidos" }, { status: 400 });
  }

  const WMS_URL = "https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ100";
  const LAYER = "NZ.RiskZone";

  // BBOX pequeño alrededor del punto
  const d = 0.0007;
  const minLat = lat - d;
  const minLon = lon - d;
  const maxLat = lat + d;
  const maxLon = lon + d;

  const width = 256;
  const height = 256;
  const I = 128;
  const J = 128;

  // Intentos:
  // 1) WMS 1.3.0 (CRS=EPSG:4326) -> bbox en orden lat,lon
  // 2) WMS 1.1.1 (SRS=EPSG:4326) -> bbox en orden lon,lat
  // y probamos varios info_format
  const attempts: Array<{ name: string; url: string }> = [];

  const infoFormats = [
    "application/json",
    "application/geo+json",
    "application/geojson",
    "text/plain",
    "text/html",
  ];

  for (const fmt of infoFormats) {
    // WMS 1.3.0: EPSG:4326 usa ejes lat,lon
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
        `&i=${I}&j=${J}`,
    });

    // WMS 1.1.1: EPSG:4326 usa bbox lon,lat
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
        `&x=${I}&y=${J}`,
    });
  }

  const debug: any[] = [];

  for (const a of attempts) {
    try {
      const { res, contentType, text } = await tryFetch(a.url);

      debug.push({
        attempt: a.name,
        ok: res.ok,
        status: res.status,
        contentType,
        snippet: snippet(text),
      });

      if (!res.ok) continue;

      // Caso JSON/GeoJSON -> si hay features => inside
      if (contentType.includes("json")) {
        try {
          const json: any = JSON.parse(text);
          const features = Array.isArray(json?.features) ? json.features : [];
          const inside = features.length > 0;
          return NextResponse.json(
            {
              inside,
              featureCount: features.length,
              source: {
                service: WMS_URL,
                layer: LAYER,
                request: "GetFeatureInfo",
                attempt: a.name,
                contentType,
              },
            },
            {
              status: 200,
              headers: {
                "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
              },
            }
          );
        } catch {
          // Si no parsea, seguimos con el siguiente intento
          continue;
        }
      }

      // Caso texto/html -> decidimos por contenido
      const empty = looksLikeEmptyFeatureInfo(text);
      const inside = !empty && text.trim().length > 0;

      return NextResponse.json(
        {
          inside,
          featureCount: inside ? 1 : 0,
          source: {
            service: WMS_URL,
            layer: LAYER,
            request: "GetFeatureInfo",
            attempt: a.name,
            contentType,
          },
          rawTextSnippet: snippet(text),
          note: inside
            ? "El punto devuelve respuesta de GetFeatureInfo en la capa Q100."
            : "No hay coincidencias de GetFeatureInfo para la capa Q100 en ese punto.",
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
          },
        }
      );
    } catch {
      // seguimos al siguiente intento
      continue;
    }
  }

  // Si llegamos aquí, ningún intento funcionó
  return NextResponse.json(
    {
      error: "No se pudo consultar Q100 (GetFeatureInfo) con formatos compatibles",
      source: { service: WMS_URL, layer: LAYER, request: "GetFeatureInfo" },
      debug,
    },
    { status: 502 }
  );
}
