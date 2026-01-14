import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EFAS_WMS = "https://european-flood.emergency.copernicus.eu/api/wms/";

function num(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function snippet(s: string, n = 260) {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, n);
}

function looksEmpty(text: string) {
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
  const res = await fetch(url, { headers: { Accept: "application/json,text/plain,text/html,*/*" } });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  return { res, contentType, text };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = num(searchParams.get("lat"));
  const lon = num(searchParams.get("lon"));
  const layer = (searchParams.get("layer") || "").trim() || null;

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "lat/lon inválidos" }, { status: 400 });
  }
  if (!layer) {
    return NextResponse.json({ error: "Falta parámetro 'layer' (name de la capa EFAS)" }, { status: 400 });
  }

  const d = 0.0009;
  const minLat = lat - d;
  const minLon = lon - d;
  const maxLat = lat + d;
  const maxLon = lon + d;

  const width = 256;
  const height = 256;
  const I = 128;
  const J = 128;

  const infoFormats = ["application/json", "application/geo+json", "text/plain", "text/html"];

  const attempts: Array<{ name: string; url: string }> = [];

  for (const fmt of infoFormats) {
    // WMS 1.3.0 (EPSG:4326 -> bbox lat,lon)
    attempts.push({
      name: `1.3.0 ${fmt}`,
      url:
        `${EFAS_WMS}?service=WMS&request=GetFeatureInfo&version=1.3.0` +
        `&crs=EPSG:4326` +
        `&bbox=${encodeURIComponent(`${minLat},${minLon},${maxLat},${maxLon}`)}` +
        `&width=${width}&height=${height}` +
        `&layers=${encodeURIComponent(layer)}` +
        `&query_layers=${encodeURIComponent(layer)}` +
        `&styles=` +
        `&format=${encodeURIComponent("image/png")}` +
        `&info_format=${encodeURIComponent(fmt)}` +
        `&i=${I}&j=${J}`,
    });

    // WMS 1.1.1 (bbox lon,lat)
    attempts.push({
      name: `1.1.1 ${fmt}`,
      url:
        `${EFAS_WMS}?service=WMS&request=GetFeatureInfo&version=1.1.1` +
        `&srs=EPSG:4326` +
        `&bbox=${encodeURIComponent(`${minLon},${minLat},${maxLon},${maxLat}`)}` +
        `&width=${width}&height=${height}` +
        `&layers=${encodeURIComponent(layer)}` +
        `&query_layers=${encodeURIComponent(layer)}` +
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

      // JSON/GeoJSON
      if (contentType.includes("json")) {
        try {
          const json: any = JSON.parse(text);
          const features = Array.isArray(json?.features) ? json.features : [];
          const inside = features.length > 0;

          return NextResponse.json(
            {
              ok: true,
              data: {
                wms_url: EFAS_WMS,
                layer_used: layer,
                inside,
                featureCount: features.length,
                rawTextSnippet: undefined,
                note: inside
                  ? "EFAS devuelve información para este punto (GetFeatureInfo)."
                  : "EFAS no devuelve entidades para este punto.",
              },
              source: {
                name: "Copernicus EFAS (WMS)",
                url: `${EFAS_WMS}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`,
                note: `Capa: ${layer} | Intento: ${a.name}`,
              },
              limitations: inside
                ? []
                : ["EFAS puede no tener cobertura o datos relevantes para este punto/tiempo; escala regional."],
            },
            { status: 200 }
          );
        } catch {
          continue;
        }
      }

      // Texto/HTML
      const empty = looksEmpty(text);
      const inside = !empty && text.trim().length > 0;

      return NextResponse.json(
        {
          ok: true,
          data: {
            wms_url: EFAS_WMS,
            layer_used: layer,
            inside,
            featureCount: inside ? 1 : 0,
            rawTextSnippet: snippet(text),
            note: inside
              ? "EFAS devuelve respuesta textual para este punto (GetFeatureInfo)."
              : "EFAS no devuelve coincidencias para este punto.",
          },
          source: {
            name: "Copernicus EFAS (WMS)",
            url: `${EFAS_WMS}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`,
            note: `Capa: ${layer} | Intento: ${a.name}`,
          },
          limitations: inside
            ? []
            : ["EFAS puede no tener cobertura o datos relevantes para este punto/tiempo; escala regional."],
        },
        { status: 200 }
      );
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "No se pudo consultar EFAS (GetFeatureInfo)",
      debug,
      source: {
        name: "Copernicus EFAS (WMS)",
        url: `${EFAS_WMS}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`,
      },
      limitations: ["El WMS de EFAS no respondió con un formato compatible o hubo error de red."],
    },
    { status: 502 }
  );
}
