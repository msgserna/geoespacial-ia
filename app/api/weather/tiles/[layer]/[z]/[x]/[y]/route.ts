import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Capas permitidas de OpenWeather Tiles
const ALLOWED_LAYERS = new Set([
  "temp_new",
  "precipitation_new",
  "clouds_new",
  "wind_new",
] as const);

type Params = {
  layer: string;
  z: string;
  x: string;
  y: string;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<Params> } // ✅ Next 15/16: params es Promise
) {
  const { layer, z, x, y } = await ctx.params; // ✅ obligatorio

  if (!ALLOWED_LAYERS.has(layer as any)) {
    return Response.json(
      { error: `Layer no permitido: ${layer}` },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Falta OPENWEATHER_API_KEY en variables de entorno" },
      { status: 500 }
    );
  }

  const upstreamUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`;

  try {
    const upstream = await fetch(upstreamUrl, { cache: "no-store" });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return Response.json(
        {
          error: `OpenWeather tiles error (${upstream.status})`,
          detail: text ? text.slice(0, 160) : undefined,
        },
        { status: upstream.status }
      );
    }

    const buf = await upstream.arrayBuffer();

    // Cache razonable (CDN/Vercel) para tiles
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=600, max-age=600",
      },
    });
  } catch (e: any) {
    return Response.json(
      { error: `OpenWeather tiles fetch failed: ${e?.message || "unknown"}` },
      { status: 502 }
    );
  }
}
