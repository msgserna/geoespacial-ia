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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FolderOpen, Trash2 } from "lucide-react";

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
            No tienes ubicaciones guardadas todavia. Genera un analisis y pulsa "Guardar ubicacion".
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

                    <TooltipProvider>
                      <div className="flex shrink-0 flex-col gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              aria-label="Cargar"
                              onClick={() => {
                                onLoad(it);
                                toast.success("Ubicacion cargada");
                                onOpenChange(false);
                              }}
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            Cargar
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="destructive"
                              aria-label="Borrar"
                              onClick={() => {
                                onDelete(it.id);
                                toast.message("Ubicacion eliminada");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={6}>
                            Borrar
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Nota</div>
                    <Textarea
                      value={it.note}
                      onChange={(e) => onUpdateNote(it.id, e.target.value)}
                      placeholder="Anade una nota personal (observaciones, ideas, dudas...)"
                      className="min-h-[88px]"
                    />
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
