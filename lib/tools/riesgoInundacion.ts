import type { FloodData, ToolResult } from "@/types/analysis";
import { IDEE_FLOOD_WMS, buildGetFeatureInfoUrl } from "@/lib/geo/wms";

async function fetchText(url: string, timeoutMs = 20_000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 200)}`);
    return { contentType: res.headers.get("content-type") || "", text };
  } finally {
    clearTimeout(id);
  }
}

// Estrategia:
// 1) GetCapabilities para saber capas disponibles
// 2) Elegir una capa “candidata” por nombre/título (heurística)
// 3) Intentar GetFeatureInfo (si falla, devolver limitación)
export async function riesgoInundacion(
  lat: number,
  lon: number
): Promise<ToolResult<FloodData>> {
  const capabilitiesUrl =
    `${IDEE_FLOOD_WMS}?service=WMS&request=GetCapabilities`;

  try {
    const { text: capsXml } = await fetchText(capabilitiesUrl, 25_000);

    // Heurística muy simple: intenta encontrar el primer <Name> que incluya algo de “ARPSI”, “pelig”, “riesg”, “inund”
    const layerNameMatches = [...capsXml.matchAll(/<Name>([^<]+)<\/Name>/g)]
      .map((m) => m[1])
      .filter(Boolean);

    const preferred = layerNameMatches.find((n) =>
      /ARPSI|PELIG|RIESG|INUND|ZONA|ZI/i.test(n)
    );

    const layer_used = preferred || layerNameMatches[0];

    if (!layer_used) {
      return {
        ok: true,
        data: {
          wms_url: IDEE_FLOOD_WMS,
          note:
            "GetCapabilities no devolvió capas interpretables. Servicio accesible, pero sin capas detectadas.",
        },
        source: { name: "IDEE WMS Inundaciones", url: capabilitiesUrl },
        limitations: ["No se pudieron detectar capas desde GetCapabilities."],
      };
    }

    const gfiUrl = buildGetFeatureInfoUrl({
      wmsBaseUrl: IDEE_FLOOD_WMS,
      layerName: layer_used,
      lat,
      lon,
      metersSpan: 500,
    });

    // 1º intento JSON
    try {
      const res = await fetch(gfiUrl, { method: "GET" });
      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();

      if (res.ok && contentType.includes("application/json")) {
        const featureInfo = JSON.parse(raw);
        return {
          ok: true,
          data: {
            wms_url: IDEE_FLOOD_WMS,
            layer_used,
            featureInfo,
            note:
              "GetFeatureInfo devuelto en JSON. Puede venir vacío si no hay entidad en el punto o la capa no tiene datos ahí.",
          },
          source: { name: "IDEE WMS Inundaciones", url: IDEE_FLOOD_WMS },
          limitations: [
            "GetFeatureInfo puede devolver vacío aunque exista cartografía cercana (depende de la capa y escala).",
          ],
        };
      }

      // Fallback texto (HTML/XML)
      return {
        ok: true,
        data: {
          wms_url: IDEE_FLOOD_WMS,
          layer_used,
          rawTextSnippet: raw.slice(0, 600),
          note:
            "GetFeatureInfo respondió en formato no JSON o sin entidades. Se adjunta snippet para trazabilidad.",
        },
        source: { name: "IDEE WMS Inundaciones", url: IDEE_FLOOD_WMS },
        limitations: [
          "El servicio WMS puede no ofrecer JSON para GetFeatureInfo en algunas capas.",
        ],
      };
    } catch (e: any) {
      return {
        ok: true,
        data: {
          wms_url: IDEE_FLOOD_WMS,
          layer_used,
          note:
            "Servicio accesible, pero GetFeatureInfo falló para la capa seleccionada. Se devuelve limitación.",
        },
        source: { name: "IDEE WMS Inundaciones", url: IDEE_FLOOD_WMS },
        limitations: [e?.message || "Fallo en GetFeatureInfo"],
      };
    }
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Error consultando WMS inundaciones",
      source: { name: "IDEE WMS Inundaciones", url: IDEE_FLOOD_WMS },
      limitations: ["El WMS puede estar caído o bloqueado temporalmente."],
    };
  }
}
