import { NextResponse } from "next/server";

export const runtime = "nodejs";

function num(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Falta OPENWEATHER_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const lat = num(searchParams.get("lat"));
  const lon = num(searchParams.get("lon"));

  if (lat === null || lon === null) {
    return NextResponse.json({ error: "lat/lon inválidos" }, { status: 400 });
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
    String(lat)
  )}&lon=${encodeURIComponent(
    String(lon)
  )}&units=metric&appid=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: "OpenWeather current error",
          status: res.status,
          detail: text.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const data: any = await res.json();

    const payload = {
      lat,
      lon,
      tempC: data?.main?.temp ?? null,
      windMs: data?.wind?.speed ?? null,
      cloudsPct: data?.clouds?.all ?? null,
      humidityPct: data?.main?.humidity ?? null,
      rain1hMm: data?.rain?.["1h"] ?? null,
      rain3hMm: data?.rain?.["3h"] ?? null,
      description: data?.weather?.[0]?.description ?? null,
      icon: data?.weather?.[0]?.icon ?? null,
      name: data?.name ?? null,
      dt: data?.dt ?? null,
      source: "OpenWeather Current (data/2.5/weather)",
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "No se pudo obtener current weather", detail: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
