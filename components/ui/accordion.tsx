import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Accordion({ children, className }: any) {
  return <div className={cn("space-y-2", className)}>{children}</div>;
}

export function AccordionItem({ children, className }: any) {
  return <div className={cn("border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm", className)}>{children}</div>;
}

export function AccordionTrigger({ children, isOpen, onClick, className }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-slate-800 transition-all hover:bg-slate-50",
        className
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
          isOpen && "rotate-180"
        )}
      />
    </button>
  );
}

export function AccordionContent({ children, isOpen, className }: any) {
  if (!isOpen) return null;
  return (
    <div className={cn("p-5 border-t border-slate-200 bg-white", className)}>
      {children}
    </div>
  );
}
