"use client";

import { Compass } from "lucide-react";
import type { AnalysisResponse, SourceRef } from "@/types/analysis";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function extractSection(text: string, label: RegExp) {
  const match = text.match(label);
  if (!match || match.index == null) return "";
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = rest.search(/^\s*\d+\.\s/m);
  const chunk = next >= 0 ? rest.slice(0, next) : rest;
  return chunk.trim();
}

export function PrintReport({ result }: { result: AnalysisResponse }) {
  const now = new Date().toLocaleString();

  const sources = asArray<SourceRef>((result as any)?.sources);
  const limitations = asArray<string>((result as any)?.limitations);
  const urban = (result as any)?.urban;
  const meteo = (result as any)?.meteo as
    | {
        tempC?: number | null;
        windMs?: number | null;
        rain1hMm?: number | null;
        description?: string | null;
      }
    | null
    | undefined;
  const air = (result as any)?.air as
    | {
        aqi?: number | null;
        pm2_5?: number | null;
        pm10?: number | null;
        no2?: number | null;
        o3?: number | null;
      }
    | null
    | undefined;
  const flood = (result as any)?.floodQ100 as { inside?: boolean; featureCount?: number } | null;
  const efas = (result as any)?.efas as { inside?: boolean; featureCount?: number } | null;
  const dynamic = (result as any)?.dynamicFloodRisk as { level?: string; reason?: string } | null;
  const layers = (result as any)?.layers as
    | { floodOn?: boolean; efasOn?: boolean; efasLayer?: string | null }
    | null
    | undefined;

  const categories =
    urban && typeof urban === "object" && (urban as any).counts
      ? Object.entries((urban as any).counts as Record<string, number>)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 15)
      : [];

  const categoryLabel = (key: string) => {
    const base = key
      .replace("amenity:", "")
      .replace("highway:", "")
      .replace("railway:", "")
      .replace("public_transport:", "")
      .replace("shop:", "")
      .replace("tourism:", "")
      .replace("building:", "")
      .replace(/_/g, " ");

    const translations: Record<string, string> = {
      crossing: "cruces de carretera",
      "stop position": "paradas de transporte publico",
      "bus stop": "paradas de autobus",
      "traffic signals": "senales de trafico",
      pharmacy: "farmacias",
      "bicycle rental": "alquiler de bicicletas",
      "place of worship": "lugares de culto",
      supermarket: "supermercados",
      bar: "bares",
      artwork: "arte urbano",
      fuel: "estaciones de combustible",
      restaurant: "restaurantes",
      cafe: "cafeterias",
      bank: "bancos",
      atm: "cajeros",
      parking: "aparcamientos",
      school: "escuelas",
      kindergarten: "guarderias",
      clinic: "clinicas",
      hospital: "hospitales",
      police: "policia",
      "fire station": "bomberos",
      viewpoint: "miradores",
      "drinking water": "fuentes de agua",
      "railway switch": "cambios de via",
      "motorway junction": "cruces de autovia",
    };

    return translations[base] ?? base;
  };

  const usos = result.report
    ? extractSection(result.report, /posibles usos urbanos\s*:\s*/i)
    : "";
  const recomendacion = result.report
    ? extractSection(result.report, /recomendacion final\s*:\s*/i)
    : "";

  return (
    <section id="print-area" className="hidden print:block print:overflow-visible">
      <div className="space-y-4 print:overflow-visible">
        <header className="border-b pb-3">
          <div className="flex items-center gap-2 text-2xl font-semibold">
            <Compass className="h-6 w-6 text-primary" />
            Asistente Geoespacial - Informe
          </div>
          <div className="mt-1 text-sm">
            <div>
              <b>Fecha:</b> {now}
            </div>
            <div>
              <b>Coordenadas:</b> {result.coords.lat}, {result.coords.lon}
            </div>
            {result.coords.label ? (
              <div>
                <b>Etiqueta:</b> {result.coords.label}
              </div>
            ) : null}
          </div>
        </header>

        <main className="space-y-4">
          {result.mapImageUrl ? (
            <section>
              <div className="text-lg font-semibold">Mapa del punto</div>
              <img
                src={result.mapImageUrl}
                alt="Mapa del punto"
                className="mt-2 w-full rounded-md border"
              />
            </section>
          ) : null}
          <section>
            <div className="flex gap-6">
              <div className="w-1/2">
                <div className="text-lg font-semibold">Meteo actual</div>
                <div className="mt-2 text-sm space-y-1">
                  <div>
                    Temperatura: {meteo?.tempC != null ? `${meteo.tempC.toFixed(2)} C` : "No disponible"}
                  </div>
                  <div>
                    Lluvia 1h:{" "}
                    {meteo?.rain1hMm != null ? `${meteo.rain1hMm.toFixed(2)} mm` : "No se preven lluvias"}
                  </div>
                  <div>
                    Viento: {meteo?.windMs != null ? `${meteo.windMs.toFixed(2)} m/s` : "No disponible"}
                  </div>
                  <div>Descripcion: {meteo?.description ?? "No disponible"}</div>
                </div>
              </div>

              <div className="w-1/2">
                <div className="text-lg font-semibold">Contaminacion del aire</div>
                <div className="mt-2 text-sm space-y-1">
                  <div>AQI: {air?.aqi != null ? String(air.aqi) : "No disponible"}</div>
                  <div>PM2.5: {air?.pm2_5 != null ? `${air.pm2_5.toFixed(2)} ug/m3` : "No disponible"}</div>
                  <div>PM10: {air?.pm10 != null ? `${air.pm10.toFixed(2)} ug/m3` : "No disponible"}</div>
                  <div>NO2: {air?.no2 != null ? `${air.no2.toFixed(2)} ug/m3` : "No disponible"}</div>
                  <div>O3: {air?.o3 != null ? `${air.o3.toFixed(2)} ug/m3` : "No disponible"}</div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm leading-relaxed w-full">
              {air?.aqi != null || meteo?.tempC != null || meteo?.windMs != null ? (
                <p>
                  {air?.aqi != null
                    ? `Calidad del aire ${air.aqi <= 2 ? "buena" : air.aqi === 3 ? "moderada" : "baja"}. `
                    : "Calidad del aire sin datos suficientes. "}
                  {meteo?.tempC != null
                    ? `Temperatura estable alrededor de ${meteo.tempC.toFixed(1)} C, `
                    : "Temperatura sin datos suficientes, "}
                  {meteo?.windMs != null
                    ? `con viento medio de ${meteo.windMs.toFixed(1)} m/s. `
                    : "con viento sin datos suficientes. "}
                  {meteo?.description
                    ? `El cielo presenta condiciones ${meteo.description}, lo que sugiere estabilidad atmosferica. `
                    : "No hay descripcion meteorologica disponible. "}
                  {air?.pm2_5 != null || air?.pm10 != null || air?.no2 != null
                    ? "Los niveles de particulas y gases reportados no indican episodios severos, por lo que la exposicion es baja en condiciones normales."
                    : "Sin datos de particulas y gases para profundizar el analisis."}
                </p>
              ) : (
                <p>Sin suficientes datos para un analisis meteo/aire.</p>
              )}
            </div>
          </section>

          <section>
            <div className="text-lg font-semibold">Infraestructura cercana</div>
            <div className="mt-2 text-sm">
              {urban && (urban as any).total != null ? (
                <>
                  <div>
                    Total de {(urban as any).total} elementos en un radio de {(urban as any).radiusMeters ?? 800} m.
                  </div>
                  {categories.length ? (
                    <div className="mt-2 grid grid-cols-3 gap-4">
                      {[0, 1, 2].map((col) => {
                        const start = col * 5;
                        const items = categories.slice(start, start + 5);
                        return (
                          <ul key={col} className="list-disc pl-5">
                            {items.map(([key, count]) => (
                              <li key={key}>
                                {count} {categoryLabel(key)}
                              </li>
                            ))}
                          </ul>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              ) : (
                <div>No se pudo obtener infraestructura cercana.</div>
              )}
            </div>
          </section>

          <section className="break-before-page">
            <div className="text-lg font-semibold">Riesgos relevantes</div>
            <div className="mt-2 text-sm space-y-1">
              <div>
                MITECO (Q100):{" "}
                {flood?.inside === true
                  ? "El punto cae en zona Q100."
                  : flood?.inside === false
                    ? "No se detecta interseccion con zona Q100."
                    : "No disponible."}
              </div>
              {layers?.efasOn ? (
                <div>
                  EFAS:{" "}
                  {efas?.inside === true
                    ? "El punto cae en la capa EFAS seleccionada."
                    : efas?.inside === false
                      ? "No se detecta interseccion con la capa EFAS seleccionada."
                      : "No disponible."}
                </div>
              ) : null}
              <div>
                Riesgo dinamico:{" "}
                {dynamic?.level ? `${dynamic.level}${dynamic.reason ? `, ${dynamic.reason}` : ""}` : "No disponible."}
              </div>
            </div>
          </section>

          <section>
            <div className="text-lg font-semibold">Posibles usos urbanos</div>
            <div className="mt-2 text-sm">{usos || "Pendiente de informe."}</div>
          </section>

          <section>
            <div className="text-lg font-semibold">Recomendacion final</div>
            <div className="mt-2 text-sm">{recomendacion || "Pendiente de informe."}</div>
          </section>

          <section>
            <div className="text-lg font-semibold">Fuentes consultadas</div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {sources.length ? (
                sources.map((s, i) => (
                  <li key={i}>
                    <b>{s.name}:</b> {s.url}
                    {s.note ? ` - ${s.note}` : ""}
                  </li>
                ))
              ) : (
                <li>Sin fuentes reportadas.</li>
              )}
            </ul>
          </section>

          <section>
            <div className="text-lg font-semibold">Limitaciones</div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {limitations.length ? (
                limitations.map((l, i) => <li key={i}>{l}</li>)
              ) : (
                <li>Sin limitaciones reportadas.</li>
              )}
            </ul>
          </section>
        </main>
      </div>
    </section>
  );
}


