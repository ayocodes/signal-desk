"use client";

// Keeps lead pages fresh while the agent works.
// Subscribes to changes on `leads` (Realtime applies RLS, so a rep only hears about their own
// leads) and re-renders the page's server data with router.refresh(). One agent run can touch
// hundreds of leads, so refreshes are debounced. If the live connection isn't up, it falls back
// to refreshing every minute while the tab is visible.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const DEBOUNCE_MS = 2_000;
const POLL_MS = 60_000;

export type LiveMode = "live" | "polling";

export function useLiveLeads(): { mode: LiveMode } {
  const router = useRouter();
  const [mode, setMode] = useState<LiveMode>("polling");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    const refreshSoon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };
    const startPolling = () => {
      poll ??= setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, refreshSoon);

    // Hand Realtime the signed-in user's token first, so RLS filters what this tab hears.
    supabase.realtime
      .setAuth()
      .then(() => {
        if (cancelled) return;
        channel.subscribe((status) => {
          const live = status === "SUBSCRIBED";
          setMode(live ? "live" : "polling");
          if (live) stopPolling();
          else startPolling();
        });
      })
      .catch((error: unknown) => {
        console.warn("Live updates are unavailable; refreshing every minute instead.", error);
      });

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      stopPolling();
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return { mode };
}
