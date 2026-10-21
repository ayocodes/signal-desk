"use client";

import * as React from "react";
import { cn } from "./utils";

export type ToastTone = "default" | "good" | "bad";

export interface ToastItem {
  id: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
}

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  message: React.ReactNode;
  tone?: ToastTone;
  onDismiss?: () => void;
}

const toneStyles: Record<ToastTone, string> = {
  default: "bg-surface text-text border-border",
  good: "bg-surface text-good border-good/30",
  bad: "bg-surface text-bad border-bad/30",
};

export function Toast({
  className,
  message,
  tone = "default",
  onDismiss,
  ...props
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-3 rounded-panel border px-3.5 py-2 text-body font-medium shadow-lg transition-all",
        toneStyles[tone],
        className
      )}
      {...props}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm text-meta"
          aria-label="Dismiss toast"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Lightweight module-level toast store so toast() works anywhere in client code.
type Listener = () => void;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function showToast(
  message: string,
  options?: { tone?: ToastTone; duration?: number }
): string {
  const id = Math.random().toString(36).slice(2, 9);
  const duration = options?.duration ?? 2500;
  const newItem: ToastItem = {
    id,
    message,
    tone: options?.tone ?? "default",
    duration,
  };

  toasts = [...toasts, newItem];
  notify();

  if (duration > 0 && typeof window !== "undefined") {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export function dismissToast(id?: string) {
  if (id) {
    toasts = toasts.filter((t) => t.id !== id);
  } else {
    toasts = [];
  }
  notify();
}

function subscribe(callback: Listener) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// useSyncExternalStore needs the same value on every call, or React warns about a loop.
const NO_TOASTS: ToastItem[] = [];

export function useToast() {
  const currentToasts = React.useSyncExternalStore(subscribe, () => toasts, () => NO_TOASTS);

  const toast = React.useCallback(
    (message: string, options?: { tone?: ToastTone; duration?: number }) => {
      return showToast(message, options);
    },
    []
  );

  const dismiss = React.useCallback((id?: string) => {
    dismissToast(id);
  }, []);

  return {
    toasts: currentToasts,
    toast,
    dismiss,
  };
}

export function ToastContainer({ className }: { className?: string }) {
  const { toasts: activeToasts, dismiss } = useToast();

  if (activeToasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className={cn(
        "fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none max-w-[calc(100%-2rem)]",
        className
      )}
    >
      {activeToasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <Toast
            message={item.message}
            tone={item.tone}
            onDismiss={() => dismiss(item.id)}
          />
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
