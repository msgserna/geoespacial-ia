"use client";

import type { SavedLocation } from "@/lib/storage/savedLocations";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SavedLocationsDialog({
  open,
  onOpenChange,
  items,
  onLoad,
  onDelete,
  onUpdateNote,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: SavedLocation[];
  onLoad: (item: SavedLocation) => void;
  onDelete: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ubicaciones guardadas</DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No tienes ubicaciones guardadas todavía. Genera un análisis y pulsa “Guardar ubicación”.
          </div>
        ) : (
          <ScrollArea className="h-[60vh] rounded-md border">
            <div className="space-y-3 p-3">
              {items.map((it) => (
                <div key={it.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(it.createdAt)}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {it.coords.lat.toFixed(5)}, {it.coords.lon.toFixed(5)}
                        </Badge>
                        <Badge variant="outline">
                          {it.snapshot?.data?.urban?.ok ? "Urban: OK" : "Urban: —"}
                        </Badge>
                        <Badge variant="outline">
                          {it.snapshot?.data?.flood?.ok ? "Flood: OK" : "Flood: —"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          onLoad(it);
                          toast.success("Ubicación cargada");
                          onOpenChange(false);
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

        <DialogFooter className="mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
