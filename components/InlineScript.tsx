"use client";

// A script that runs once while the browser parses the server HTML (before first paint).
// On the client React would warn about rendering a <script>, so there it becomes inert
// text/plain; suppressHydrationWarning covers that type difference. See Next's guide
// "preventing-flash-before-hydration".
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
