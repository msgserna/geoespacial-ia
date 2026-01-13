import { fetchJson } from "@/lib/http/fetchJson";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements: OverpassElement[];
};

export async function overpassQuery(query: string) {
  const endpoint = "https://overpass-api.de/api/interpreter";

  // Overpass acepta POST con el body como texto (query)
  const res = await fetchJson<OverpassResponse>(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query,
    },
    25_000
  );

  return { endpoint, res };
}
