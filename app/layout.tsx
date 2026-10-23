import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { InlineScript } from "@/components/InlineScript";
import { BRAND_NAME } from "@/lib/brand";
import { THEME_INIT_SCRIPT } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: "Finds companies with public buying signals and drafts grounded outreach.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script sets data-theme before first paint, so the server's value can differ
    // from the browser's: suppressHydrationWarning covers exactly that attribute mismatch.
    <html
      lang="en"
      data-theme="paper"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
