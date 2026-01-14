"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AnalysisResponse } from "@/types/analysis";
import { SourcesLimitations } from "@/components/report/sources-limitations";
import { Loader2 } from "lucide-react";

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
        <div className="h-full overflow-y-auto pr-2">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex h-full flex-col items-center gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando informe...
              </div>
              <div className="w-full space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          ) : !result ? (
            <div className="text-sm text-muted-foreground">
              Aún no hay análisis. Busca una dirección o marca un punto en el mapa.
            </div>
          ) : (
            <Tabs defaultValue="report" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="report">Informe IA</TabsTrigger>
                <TabsTrigger value="sources">Fuentes</TabsTrigger>
              </TabsList>

              <TabsContent value="report" className="mt-4">
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
