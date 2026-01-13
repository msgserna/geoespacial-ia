// Utilidades WMS + WebMercator para GetFeatureInfo
export const IDEE_FLOOD_WMS =
  "https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones";

function lonLatToWebMercator(lon: number, lat: number) {
  const R = 6378137;
  const x = (lon * Math.PI * R) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return { x, y };
}

export function buildGetFeatureInfoUrl(params: {
  wmsBaseUrl: string;
  layerName: string;
  lat: number;
  lon: number;
  metersSpan?: number; // tamaño del bbox
}) {
  const { wmsBaseUrl, layerName, lat, lon } = params;
  const metersSpan = params.metersSpan ?? 400;

  const p = lonLatToWebMercator(lon, lat);

  const half = metersSpan / 2;
  const minx = p.x - half;
  const miny = p.y - half;
  const maxx = p.x + half;
  const maxy = p.y + half;

  const width = 101;
  const height = 101;
  const i = 50;
  const j = 50;

  const u = new URL(wmsBaseUrl);
  u.searchParams.set("SERVICE", "WMS");
  u.searchParams.set("VERSION", "1.3.0");
  u.searchParams.set("REQUEST", "GetFeatureInfo");
  u.searchParams.set("CRS", "EPSG:3857");
  u.searchParams.set("BBOX", `${minx},${miny},${maxx},${maxy}`);
  u.searchParams.set("WIDTH", String(width));
  u.searchParams.set("HEIGHT", String(height));
  u.searchParams.set("I", String(i));
  u.searchParams.set("J", String(j));
  u.searchParams.set("LAYERS", layerName);
  u.searchParams.set("QUERY_LAYERS", layerName);
  u.searchParams.set("INFO_FORMAT", "application/json");

  return u.toString();
}
