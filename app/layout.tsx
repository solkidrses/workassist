import type { Metadata, Viewport } from "next";
import Script from "next/script";
import BottomNav from "@/components/BottomNav";
import { AccessProvider } from "@/lib/AccessProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal AI Assistant",
  description: "Work instructions base in TMA",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AccessProvider>
          {children}
          <BottomNav />
        </AccessProvider>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
