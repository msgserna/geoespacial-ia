"use client";

import type { AnalysisResponse, SourceRef } from "@/types/analysis";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function PrintReport({ result }: { result: AnalysisResponse }) {
  const now = new Date().toLocaleString();

  const sources = asArray<SourceRef>((result as any)?.sources);
  const limitations = asArray<string>((result as any)?.limitations);

  return (
    <section
      id="print-area"
      className="hidden print:block print:overflow-visible"
    >
      <div className="space-y-4 print:overflow-visible">
        <header className="border-b pb-3">
          <div className="text-2xl font-semibold">MAP-IA — Informe</div>
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
          <section>
            <div className="text-lg font-semibold">Informe IA</div>
            <div className="mt-2 whitespace-pre-wrap text-sm break-words">
              {result.report}
            </div>
          </section>

          <section>
            <div className="text-lg font-semibold">Fuentes consultadas</div>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {sources.length ? (
                sources.map((s, i) => (
                  <li key={i}>
                    <b>{s.name}:</b> {s.url}
                    {s.note ? ` — ${s.note}` : ""}
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
