import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EFAS_WMS = "https://european-flood.emergency.copernicus.eu/api/wms/";

type EfasLayerInfo = {
  name: string;
  title?: string;
  abstract?: string;
  queryable?: boolean;
};

function pickDefaultTime(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;

  // Caso 1: lista separada por comas
  if (s.includes(",")) {
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }

  // Caso 2: rango ISO start/end/period
  // ej: 2026-01-01T00:00:00Z/2026-01-10T00:00:00Z/PT24H
  if (s.includes("/")) {
    const parts = s.split("/").map((p) => p.trim());
    if (parts.length >= 2 && parts[1]) return parts[1]; // usamos el "end"
  }

  // Caso 3: un único valor
  return s;
}

function extractTimeDimension(xml: string): string | null {
  // Buscamos Dimension/Extent time (puede aparecer varias veces)
  const dimMatch =
    xml.match(
      /<Dimension[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/Dimension>/i
    ) ||
    xml.match(/<Extent[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/Extent>/i);

  const raw = dimMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  return pickDefaultTime(raw);
}

function extractLayers(xml: string): EfasLayerInfo[] {
  // Parser “suficiente” sin dependencias: extrae Name/Title/Abstract/queryable
  // Nota: esto puede incluir capas “grupo”; filtramos las que tengan Name real.
  const layers: EfasLayerInfo[] = [];

  // Captura bloques <Layer ...> ... </Layer> (no es un XML parser perfecto, pero suele valer)
  // Para evitar locuras, capturamos Name + Title dentro de cada bloque.
  const layerBlocks = xml.match(/<Layer\b[\s\S]*?<\/Layer>/gi) ?? [];

  for (const block of layerBlocks) {
    const name = block.match(/<Name>([^<]+)<\/Name>/i)?.[1]?.trim();
    if (!name) continue;

    const title = block.match(/<Title>([^<]+)<\/Title>/i)?.[1]?.trim();
    const abs = block.match(/<Abstract>([\s\S]*?)<\/Abstract>/i)?.[1]?.trim();

    const queryableStr = block.match(/<Layer[^>]*queryable=["']?(\d)["']?/i)?.[1];
    const queryable = queryableStr ? queryableStr === "1" : undefined;

    layers.push({
      name,
      title,
      abstract: abs ? abs.replace(/\s+/g, " ").trim() : undefined,
      queryable,
    });
  }

  // Deduplicar por name (por si el regex pilla duplicados)
  const seen = new Set<string>();
  const unique: EfasLayerInfo[] = [];
  for (const l of layers) {
    if (seen.has(l.name)) continue;
    seen.add(l.name);
    unique.push(l);
  }

  return unique;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const selectedLayer = url.searchParams.get("layer"); // opcional (solo informativo)

    const capUrl = `${EFAS_WMS}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`;
    const res = await fetch(capUrl, {
      // EFAS a veces cachea, pero a nosotros nos va bien refrescar
      cache: "no-store",
      headers: {
        "User-Agent": "map-ia/1.0",
        Accept: "application/xml,text/xml,*/*",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `EFAS GetCapabilities error (${res.status})`,
          details: text.slice(0, 400),
        },
        { status: 502 }
      );
    }

    const xml = await res.text();

    const layers = extractLayers(xml);
    const defaultTime = extractTimeDimension(xml);

    return NextResponse.json({
      ok: true,
      wmsUrl: EFAS_WMS,
      selectedLayer,
      layers,
      defaultTime, // <- clave para que se “vea” al pintar WMS-T
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "EFAS capabilities error" },
      { status: 500 }
    );
  }
}
