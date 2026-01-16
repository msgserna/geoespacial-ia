"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  address: string;
  onAddressChange: (v: string) => void;
  onAnalyzeByAddress: () => void;
  onSuggestionPick: (s: { label: string; lat: number; lon: number }) => void;
  disabled?: boolean;
};

export function AddressSearch({
  address,
  onAddressChange,
  onAnalyzeByAddress,
  onSuggestionPick,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ label: string; lat: number; lon: number }>>(
    []
  );
  const [allowSuggest, setAllowSuggest] = useState(true);
  const skipSuggestRef = useRef(false);
  const canSuggest = useMemo(() => address.trim().length >= 3 && !disabled, [address, disabled]);

  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      setSuggestions([]);
      return;
    }

    if (!canSuggest || !allowSuggest) {
      setSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/suggest?query=${encodeURIComponent(address.trim())}`);
        const json = await res.json().catch(() => ({}));
        const items = Array.isArray(json?.suggestions) ? json.suggestions : [];
        setSuggestions(items);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [address, canSuggest, allowSuggest]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setSuggestions([]);
        setAllowSuggest(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const compactLabel = (label: string) => {
    const parts = label
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}, ${parts[parts.length - 1]}`;
    return label;
  };

  return (
    <div id="onborda-search" className="flex flex-col gap-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Buscar por direccion</div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="text-xs text-muted-foreground underline underline-offset-4">
              Ayuda
            </TooltipTrigger>
            <TooltipContent>
              Escribe una direccion o selecciona un punto en el mapa.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="relative">
        <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={address}
          onChange={(e) => {
            onAddressChange(e.target.value);
            setAllowSuggest(true);
          }}
          onFocus={() => setAllowSuggest(true)}
          placeholder="Ej: Gran Via 1, Madrid"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!disabled && address.trim().length >= 4) {
                skipSuggestRef.current = true;
                setSuggestions([]);
                setAllowSuggest(false);
                inputRef.current?.blur();
                onAnalyzeByAddress();
              }
            }
          }}
        />
          <Button onClick={onAnalyzeByAddress} disabled={disabled || address.trim().length < 4}>
            Ir
          </Button>
        </div>

        {suggestions.length ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-44 overflow-y-auto rounded-md border border-input bg-background/90 text-sm shadow-xs backdrop-blur">
            {suggestions.map((s, idx) => (
              <button
                key={`${s.lat}-${s.lon}-${idx}`}
                type="button"
                className="w-full px-3 py-2 text-left leading-tight hover:bg-muted"
                onClick={() => {
                  skipSuggestRef.current = true;
                  onSuggestionPick(s);
                  setSuggestions([]);
                  setAllowSuggest(false);
                }}
              >
                <div className="truncate">{compactLabel(s.label)}</div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
