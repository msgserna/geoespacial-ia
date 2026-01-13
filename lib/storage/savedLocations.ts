import type { AnalysisResponse, LatLon } from "@/types/analysis";

export type SavedLocation = {
  id: string;
  title: string;
  coords: LatLon;
  createdAt: string; // ISO
  note: string;
  snapshot: AnalysisResponse;
};

const STORAGE_KEY = "map-ia:savedLocations:v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadSavedLocations(): SavedLocation[] {
  if (typeof window === "undefined") return [];
  const data = safeParse<SavedLocation[]>(window.localStorage.getItem(STORAGE_KEY));
  if (!data || !Array.isArray(data)) return [];
  return data;
}

export function saveSavedLocations(list: SavedLocation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function createSavedLocation(args: {
  title: string;
  coords: LatLon;
  note?: string;
  snapshot: AnalysisResponse;
}): SavedLocation {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: args.title.trim(),
    coords: args.coords,
    createdAt: new Date().toISOString(),
    note: args.note ?? "",
    snapshot: args.snapshot,
  };
}

export function upsertLocation(list: SavedLocation[], item: SavedLocation) {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    const copy = list.slice();
    copy[idx] = item;
    return copy;
  }
  return [item, ...list];
}

export function removeLocation(list: SavedLocation[], id: string) {
  return list.filter((x) => x.id !== id);
}

export function updateLocationNote(list: SavedLocation[], id: string, note: string) {
  return list.map((x) => (x.id === id ? { ...x, note } : x));
}
