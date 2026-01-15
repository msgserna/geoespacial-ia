import { NextResponse } from "next/server";

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
  if (!data?.length) throw new Error("No se encontraron coordenadas para la direccion.");

  const item = data[0];
  const lat = asNum(item?.lat);
  const lon = asNum(item?.lon);
  if (lat === null || lon === null) throw new Error("Respuesta invalida de Nominatim.");

  return { lat, lon, label: item?.display_name ?? address };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const address = typeof body?.address === "string" ? body.address.trim() : "";

    if (!address) {
      return NextResponse.json({ error: "Debes enviar address." }, { status: 400 });
    }

    const coords = await buscarCoordenadas(address);
    return NextResponse.json({ ok: true, coords }, { status: 200 });
  } catch (e: any) {
    const message = String(e?.message ?? e);
    if (message.includes("No se encontraron coordenadas")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Error en /api/geocode", detail: message },
      { status: 500 }
    );
  }
}
