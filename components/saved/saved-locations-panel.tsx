"use client";

import type { SavedLocation } from "@/lib/storage/savedLocations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function SavedLocationsPanel({
  items,
  onLoad,
  onDelete,
  onUpdateNote,
}: {
  items: SavedLocation[];
  onLoad: (item: SavedLocation) => void;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}) {
  return (
    <Card className="shrink-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ubicaciones guardadas</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Aún no has guardado ubicaciones. Genera un análisis y pulsa “Guardar ubicación”.
          </div>
        ) : (
          <ScrollArea className="h-56 rounded-md border">
            <div className="p-3 space-y-3">
              {items.map((it) => (
                <div key={it.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{it.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(it.createdAt)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {it.coords.lat.toFixed(5)}, {it.coords.lon.toFixed(5)}
                        </Badge>
                        <Badge variant="outline">
                          {(it.snapshot?.data?.urban?.ok ?? Boolean((it.snapshot as any)?.urban))
                            ? "Urban: OK"
                            : "Urban: -"}
                        </Badge>
                        <Badge variant="outline">
                          {(it.snapshot?.data?.flood?.ok ?? Boolean((it.snapshot as any)?.floodQ100))
                            ? "Flood: OK"
                            : "Flood: -"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          onLoad(it);
                          toast.success("Ubicación cargada");
                        }}
                      >
                        Cargar
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          onDelete(it.id);
                          toast.message("Ubicación eliminada");
                        }}
                      >
                        Borrar
                      </Button>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Nota</div>
                    <Textarea
                      value={it.note}
                      onChange={(e) => onUpdateNote(it.id, e.target.value)}
                      placeholder="Añade una nota personal (observaciones, ideas, dudas...)"
                      className="min-h-[88px]"
                    />
                    <div className="text-xs text-muted-foreground">
                      La nota se guarda automáticamente en tu navegador (localStorage).
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
