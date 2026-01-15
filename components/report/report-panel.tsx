"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AnalysisResponse } from "@/types/analysis";
import { SourcesLimitations } from "@/components/report/sources-limitations";
import { Sparkles } from "lucide-react";

function splitReportSections(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = [...trimmed.matchAll(/(?:^|\n)(\d+\.\s[\s\S]*?)(?=\n\d+\.\s|$)/g)];
  if (matches.length) return matches.map((m) => m[1].trim());
  return trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

const SECTION_TITLES = [
  "Descripcion de la zona",
  "Infraestructura cercana",
  "Riesgos relevantes",
  "Posibles usos urbanos",
  "Recomendacion final",
  "Fuentes y limitaciones",
];

function parseSection(section: string) {
  const match = section.match(/^(\d+)\.\s*([\s\S]*)$/);
  if (!match) return null;

  const number = match[1];
  const rest = match[2].trim();

  const titleHit = SECTION_TITLES.find((t) => rest.toLowerCase().startsWith(t.toLowerCase()));
  if (titleHit) {
    let body = rest.slice(titleHit.length).trim();
    body = body.replace(/^:\s*/, "");
    return {
      title: `${number}. ${titleHit}`,
      body,
    };
  }

  const legacy = rest.match(/^([^:]+):\s*([\s\S]*)$/);
  if (legacy) {
    return {
      title: `${number}. ${legacy[1].trim()}`,
      body: legacy[2].trim(),
    };
  }

  return {
    title: `${number}.`,
    body: rest,
  };
}

function isInfraSection(title: string) {
  return title.toLowerCase().includes("infraestructura cercana");
}

export function ReportPanel({
  loading,
  result,
  error,
}: {
  loading: boolean;
  result: AnalysisResponse | null;
  error: string | null;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle>Resultados</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-6 w-6 animate-pulse text-primary" />
            Generando informe...
          </div>
        ) : !result ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Aun no hay analisis. Busca una direccion o marca un punto en el mapa.
          </div>
        ) : (
          <div className="soft-scroll h-full overflow-y-auto pr-2">
            <Tabs defaultValue="report" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="report">Informe IA</TabsTrigger>
                <TabsTrigger value="sources">Fuentes</TabsTrigger>
              </TabsList>

              <TabsContent value="report" className="mt-4">
                {result.mapImageUrl ? (
                  <img
                    src={result.mapImageUrl}
                    alt="Mapa del punto"
                    className="mb-3 w-full rounded-md border"
                  />
                ) : null}
                <div className="space-y-4 text-sm break-words">
                  {splitReportSections(result.report).map((section, index) => {
                    const parsed = parseSection(section);
                    if (!parsed) {
                      return (
                        <p key={index} className="whitespace-pre-wrap break-words">
                          {section}
                        </p>
                      );
                    }

                    const title = parsed.title;
                    const body = parsed.body;
                    const lines = body.split(/\n+/).map((line) => line.trim()).filter(Boolean);

                    if (isInfraSection(title)) {
                      const joined = lines.join(" ");
                      return (
                        <div key={index} className="space-y-1">
                          <div className="font-semibold text-primary">{title}</div>
                          <div className="break-words">{joined}</div>
                        </div>
                      );
                    }

                    return (
                      <div key={index} className="space-y-1">
                        <div className="font-semibold text-primary">{title}</div>
                        {lines.length ? (
                          lines.map((line, idx) => (
                            <div key={idx} className={/https?:\/\//i.test(line) ? "break-all" : undefined}>
                              {line}
                            </div>
                          ))
                        ) : (
                          <div>{body}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                <SourcesLimitations
                  sources={result.sources ?? []}
                  limitations={result.limitations ?? []}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
