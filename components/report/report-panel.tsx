"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AnalysisResponse } from "@/types/analysis";
import { SourcesLimitations } from "@/components/report/sources-limitations";
import { Sparkles } from "lucide-react";

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
            <Sparkles className="h-6 w-6 animate-pulse text-muted-foreground" />
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
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {result.report}
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
