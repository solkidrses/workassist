import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal AI Assistant",
  description: "Work instructions base in TMA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
