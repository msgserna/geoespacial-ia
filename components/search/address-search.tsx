"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  address: string;
  onAddressChange: (v: string) => void;
  onAnalyzeByAddress: () => void;
  disabled?: boolean;
};

export function AddressSearch({
  address,
  onAddressChange,
  onAnalyzeByAddress,
  disabled,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Buscar por dirección</div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-xs text-muted-foreground underline underline-offset-4">
              Ayuda
            </TooltipTrigger>
            <TooltipContent>
              Escribe una dirección o selecciona un punto en el mapa.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Ej: Gran Vía 1, Madrid"
        />
        <Button onClick={onAnalyzeByAddress} disabled={disabled || address.trim().length < 4}>
          Analizar
        </Button>
      </div>
    </div>
  );
}
