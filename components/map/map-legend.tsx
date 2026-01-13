"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MapLegend() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Leyenda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Punto seleccionado</span>
          <Badge>Marker</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Radio análisis</span>
          <Badge variant="secondary">~900m</Badge>
        </div>
        <div className="text-muted-foreground">
          Datos: OSM (Nominatim/Overpass) + WMS IDEE (inundaciones). Si una fuente no responde, se reporta como limitación.
        </div>
      </CardContent>
    </Card>
  );
}
