import type { ToolResult, UrbanismData } from "@/types/analysis";
import { overpassQuery } from "@/lib/geo/overpass";

function topNCounts(counts: Record<string, number>, n = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => ({ amenity: k, count: v }));
}

export async function capasUrbanismo(
  lat: number,
  lon: number,
  radius_m = 900
): Promise<ToolResult<UrbanismData>> {
  // Query compacta: amenities, transport, carreteras principales, parques
  const q = `
[out:json][timeout:25];
(
  node(around:${radius_m},${lat},${lon})["amenity"];
  node(around:${radius_m},${lat},${lon})["highway"="bus_stop"];
  node(around:${radius_m},${lat},${lon})["railway"~"^(station|halt)$"];
  way(around:${radius_m},${lat},${lon})["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"];
  way(around:${radius_m},${lat},${lon})["leisure"="park"];
);
out tags center 250;
`.trim();

  try {
    const { endpoint, res } = await overpassQuery(q);

    const amenityCounts: Record<string, number> = {};
    let busStops = 0;
    let stations = 0;
    const roadCounts: Record<string, number> = {};
    let parks = 0;

    const rawSample = res.elements.slice(0, 30).map((el) => ({
      type: el.type,
      tags: el.tags,
      center: el.center,
    }));

    for (const el of res.elements) {
      const tags = el.tags || {};

      if (tags.amenity) {
        amenityCounts[tags.amenity] = (amenityCounts[tags.amenity] || 0) + 1;
      }

      if (tags.highway === "bus_stop") busStops += 1;
      if (tags.railway && /^(station|halt)$/.test(tags.railway)) stations += 1;

      if (tags.highway && /^(motorway|trunk|primary|secondary|tertiary)$/.test(tags.highway)) {
        roadCounts[tags.highway] = (roadCounts[tags.highway] || 0) + 1;
      }

      if (tags.leisure === "park") parks += 1;
    }

    const counts: Record<string, number> = {
      amenities_total: Object.values(amenityCounts).reduce((a, b) => a + b, 0),
      bus_stops: busStops,
      stations,
      parks,
      roads_total: Object.values(roadCounts).reduce((a, b) => a + b, 0),
    };

    return {
      ok: true,
      data: {
        radius_m,
        counts,
        topAmenities: topNCounts(amenityCounts, 10),
        transport: { bus_stops: busStops, stations },
        roads: Object.entries(roadCounts).map(([highway, count]) => ({ highway, count })),
        parks,
        rawSample,
      },
      source: {
        name: "OpenStreetMap Overpass API",
        url: endpoint,
        note: "Consulta vectorial alrededor del punto (amenity/transport/roads/parks).",
      },
      limitations: [
        "Los resultados dependen de la completitud de OpenStreetMap en la zona.",
        `Radio de búsqueda: ${radius_m}m. No es un análisis urbano oficial; es inventario OSM.`,
      ],
    };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.message || "Error consultando Overpass",
      source: { name: "OpenStreetMap Overpass API", url: "https://overpass-api.de/api/interpreter" },
      limitations: ["El servicio Overpass puede estar saturado en horas punta."],
    };
  }
}
