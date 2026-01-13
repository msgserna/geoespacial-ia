import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_LAYERS = new Set([
  "temp_new",
  "precipitation_new",
  "clouds_new",
  "wind_new",
]);

function asInt(v: string) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _req: Request,
  ctx: {
    params:
      | Promise<{ layer?: string; z?: string; x?: string; y?: string }>
      | { layer?: string; z?: string; x?: string; y?: string };
  }
) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Falta OPENWEATHER_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  // ✅ Next 15/16: params puede ser Promise
  const params = await Promise.resolve(ctx.params);

  const layer = (params as any).layer ?? (params as any).Layer;
  const z = params.z;
  const x = params.x;
  let y = params.y;

  if (!layer || !z || !x || !y) {
    return NextResponse.json(
      { error: "Parámetros faltantes", params },
      { status: 400 }
    );
  }

  // Soporte si viene con extensión .png
  if (y.endsWith(".png")) y = y.slice(0, -4);

  if (!ALLOWED_LAYERS.has(layer)) {
    return NextResponse.json(
      { error: `Layer no permitido: ${layer}` },
      { status: 400 }
    );
  }

  const zi = asInt(z);
  const xi = asInt(x);
  const yi = asInt(y);

  if (zi === null || xi === null || yi === null) {
    return NextResponse.json(
      { error: "Parámetros de tile inválidos.", z, x, y },
      { status: 400 }
    );
  }

  const url = `https://tile.openweathermap.org/map/${layer}/${zi}/${xi}/${yi}.png?appid=${encodeURIComponent(
    key
  )}`;

  try {
    const res = await fetch(url, { headers: { Accept: "image/png" } });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "OpenWeatherMap tile error",
          status: res.status,
          detail: text.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "No se pudo obtener el tile de OpenWeatherMap",
        detail: String(e?.message ?? e),
      },
      { status: 502 }
    );
  }
}
