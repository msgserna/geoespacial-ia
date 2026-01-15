import { NextResponse } from "next/server";

function asNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Suggestion = {
  label: string;
  lat: number;
  lon: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("query") || "").trim();

    if (!query) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    const ua = process.env.NOMINATIM_USER_AGENT || "map-ia/1.0 (contact: example@example.com)";
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
      query
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

    const suggestions: Suggestion[] = (data || [])
      .map((item) => {
        const lat = asNum(item?.lat);
        const lon = asNum(item?.lon);
        if (lat === null || lon === null) return null;
        return {
          label: String(item?.display_name || query),
          lat,
          lon,
        };
      })
      .filter(Boolean) as Suggestion[];

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Error en /api/geocode/suggest", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
