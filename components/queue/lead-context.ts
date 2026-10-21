"use client";

import * as React from "react";

export interface SelectedLeadContext {
  id: string;
  domain: string;
  companyName: string;
  nextLeadId?: string;
  nextLeadHref?: string;
}

let activeLead: SelectedLeadContext | null = null;
const listeners = new Set<(ctx: SelectedLeadContext | null) => void>();

export function setSelectedLeadContext(ctx: SelectedLeadContext | null) {
  activeLead = ctx;
  listeners.forEach((listener) => listener(ctx));
}

export function getSelectedLeadContext(): SelectedLeadContext | null {
  return activeLead;
}

export function useSelectedLeadContext(): SelectedLeadContext | null {
  const [ctx, setCtx] = React.useState<SelectedLeadContext | null>(activeLead);

  React.useEffect(() => {
    listeners.add(setCtx);
    return () => {
      listeners.delete(setCtx);
    };
  }, []);

  return ctx;
}

export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target) return false;
  if (typeof HTMLElement !== "undefined" && !(target instanceof HTMLElement)) {
    return false;
  }
  const el = target as Partial<HTMLElement>;
  const tag = el.tagName ? el.tagName.toLowerCase() : "";
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    Boolean(el.isContentEditable) ||
    el.getAttribute?.("role") === "textbox" ||
    Boolean(el.closest?.("[contenteditable='true']"))
  );
}
