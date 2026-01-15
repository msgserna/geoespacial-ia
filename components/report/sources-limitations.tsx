"use client";

import type { SourceRef } from "@/types/analysis";

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asSources(v: unknown): SourceRef[] {
  if (Array.isArray(v)) return v as SourceRef[];

  // Si viene como objeto { key: value }, lo convertimos a SourceRef[]
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, any>).map(([name, val]) => {
      if (typeof val === "string") return { name, url: val };
      return {
        name: val?.name ?? name,
        url: val?.url ?? String(val ?? ""),
        note: val?.note,
      };
    });
  }

  return [];
}

export function SourcesLimitations({
  sources,
  limitations,
}: {
  sources: SourceRef[] | unknown;
  limitations: string[] | unknown;
}) {
  const safeSources = asSources(sources);
  const safeLimitations = asArray<string>(limitations);

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <div className="font-medium">Fuentes consultadas</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {safeSources.length ? (
            safeSources.map((s, i) => (
              <li key={i} className="break-words">
                <b>{s.name}:</b>{" "}
                {typeof s.url === "string" && /^https?:\/\//i.test(s.url) ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="break-all underline text-primary">
                    {s.url}
                  </a>
                ) : (
                  s.url
                )}
                {s.note ? ` - ${s.note}` : ""}
              </li>
            ))
          ) : (
            <li>Sin fuentes reportadas.</li>
          )}
        </ul>
      </div>

      <div className="rounded-md border p-3">
        <div className="font-medium">Limitaciones</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {safeLimitations.length ? (
            safeLimitations.map((l, i) => <li key={i} className="break-words">{l}</li>)
          ) : (
            <li>Sin limitaciones reportadas.</li>
          )}
        </ul>
      </div>
    </div>
  );
}


