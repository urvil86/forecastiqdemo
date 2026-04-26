import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { StoreInit } from "@/components/StoreInit";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "ForecastIQ — Connected LRP + STF Forecasting",
  description: "Connected long-range and short-term forecasting platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;800;900&family=Open+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="bg-background text-foreground font-body antialiased">
        <StoreInit />
        <AppShell>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AppShell>
      </body>
    </html>
  );
}
