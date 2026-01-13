"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AnalysisResponse } from "@/types/analysis";
import { SourcesLimitations } from "@/components/report/sources-limitations";

export function ReportPanel({
  loading,
  result,
  error,
}: {
  loading: boolean;
  result: AnalysisResponse | null;
  error: string | null;
}) {
  const data = result?.data;

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0 pb-3">
        <CardTitle>Resultados</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto pr-2">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !result ? (
            <div className="text-sm text-muted-foreground">
              Aún no hay análisis. Busca una dirección o marca un punto en el
              mapa.
            </div>
          ) : (
            <Tabs defaultValue="report" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="data">Datos</TabsTrigger>
                <TabsTrigger value="report">Informe IA</TabsTrigger>
                <TabsTrigger value="sources">Fuentes</TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="mt-4 space-y-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="font-medium">Infraestructura (OSM)</div>
                  <pre className="mt-2 overflow-auto text-xs">
                    {JSON.stringify(data?.urban ?? null, null, 2)}
                  </pre>
                </div>

                <div className="rounded-md border p-3">
                  <div className="font-medium">Inundación (WMS IDEE)</div>
                  <pre className="mt-2 overflow-auto text-xs">
                    {JSON.stringify(data?.flood ?? null, null, 2)}
                  </pre>
                </div>

                {/* Opcional: Meteo puntual si lo incluyes en /api/analyze */}
                {data?.weather ? (
                  <div className="rounded-md border p-3">
                    <div className="font-medium">Meteo (OpenWeather)</div>
                    <pre className="mt-2 overflow-auto text-xs">
                      {JSON.stringify(data.weather ?? null, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="report" className="mt-4">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {result?.report ?? ""}
                </div>
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                <SourcesLimitations
                  sources={result?.sources ?? []}
                  limitations={result?.limitations ?? []}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
