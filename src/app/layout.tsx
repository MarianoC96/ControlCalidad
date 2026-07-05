import type { Metadata, Viewport } from "next";
import "./globals.css";
// Self-hosted (antes CDN jsdelivr, que dejaba la UI sin íconos ante un 503).
// Next empaqueta el CSS y sirve las fuentes woff/woff2 desde el propio bundle.
import "bootstrap-icons/font/bootstrap-icons.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import AppShell from "@/components/AppShell";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Control Calidad - El Olivar",
  description: "Sistema de Control Calidad para Registro de Productos - El Olivar",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003019",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Preconnect to Supabase for faster API calls */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ''} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ''} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistration />
        <SpeedInsights />
      </body>
    </html>
  );
}
