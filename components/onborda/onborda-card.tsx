"use client";

import { useEffect } from "react";
import type { CardComponentProps } from "onborda";
import { useOnborda } from "onborda";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OnbordaCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda();
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isWelcome = step.selector === "#onborda-welcome-anchor";

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isWelcome) {
      document.body.dataset.onbordaWelcome = "1";
    } else {
      delete document.body.dataset.onbordaWelcome;
    }

    return () => {
      delete document.body.dataset.onbordaWelcome;
    };
  }, [isWelcome]);

  return (
    <div className="glass-panel relative w-[280px] rounded-2xl border border-border/70 p-4 text-foreground shadow-xl sm:w-[360px]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Paso {currentStep + 1} de {totalSteps}
          </div>
          <div className="text-base font-semibold">{step.title}</div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cerrar guia"
          onClick={closeOnborda}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 text-sm text-muted-foreground">{step.content}</div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="secondary" onClick={prevStep} disabled={isFirst}>
          Anterior
        </Button>
        <Button size="sm" onClick={isLast ? closeOnborda : nextStep}>
          {isLast ? "Finalizar" : "Siguiente"}
        </Button>
      </div>

      {!isWelcome ? <div className="text-primary">{arrow}</div> : null}
    </div>
  );
}
