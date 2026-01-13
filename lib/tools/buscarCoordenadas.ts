import { fetchJson } from "@/lib/http/fetchJson";
import type { GeocodeData, ToolResult } from "@/types/analysis";

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
};

export async function buscarCoordenadas(
  direccion: string
): Promise<ToolResult<GeocodeData>> {
  const ua = process.env.NOMINATIM_USER_AGENT;
  if (!ua) {
    return {
      ok: false,
      error: "Falta NOMINATIM_USER_AGENT en .env.local",
      limitations: ["Configura NOMINATIM_USER_AGENT para cumplir la política de Nominatim."],
      source: {
        name: "OpenStreetMap Nominatim",
        url: "https://nominatim.openstreetmap.org/",
      },
    };
  }

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
    encodeURIComponent(direccion);

  try {
    const items = await fetchJson<NominatimItem[]>(url, {
      headers: { "User-Agent": ua },
    });

    const first = items?.[0];
    if (!first) {
      return {
        ok: false,
        error: "No se encontró ninguna coincidencia para esa dirección.",
        source: { name: "OpenStreetMap Nominatim", url },
      };
    }

    const lat = Number(first.lat);
    const lon = Number(first.lon);

    return {
      ok: true,
      data: {
        query: direccion,
        lat,
        lon,
        display_name: first.display_name,
        provider: "OpenStreetMap Nominatim",
      },
      source: { name: "OpenStreetMap Nominatim", url },
      limitations: [
        "Resultado basado en la primera coincidencia de Nominatim (limit=1).",
      ],
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Error consultando Nominatim",
      source: { name: "OpenStreetMap Nominatim", url },
    };
  }
}
