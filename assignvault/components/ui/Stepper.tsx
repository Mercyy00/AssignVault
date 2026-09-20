import React from "react";
import { cn } from "@/lib/utils";

export interface StepItem {
  number: number | string;
  title: string;
  description: string;
}

export interface StepperProps {
  steps: StepItem[];
  className?: string;
}

export function Stepper({ steps, className }: StepperProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", className)}>
      {steps.map((step, idx) => (
        <div
          key={idx}
          className="relative flex flex-col p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm shadow-blue-200 dark:shadow-none">
              {step.number}
            </span>
            <h4 className="font-semibold text-base text-zinc-900 dark:text-white">{step.title}</h4>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {step.description}
          </p>
        </div>
      ))}
    </div>
  );
}
