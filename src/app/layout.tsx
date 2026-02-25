import type { Metadata, Viewport } from "next";
import "./globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Control de Calidad",
  description: "Sistema de Control de Calidad para Registro de Productos",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#607d8b",
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
        <SpeedInsights />
      </body>
    </html>
  );
}
