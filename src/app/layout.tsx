import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import { SkipLink, Header, Footer } from "@/components";
import "./globals.css";

const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "600", "800"],
  variable: "--font-mukta",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16262B",
};

export const metadata: Metadata = {
  title: "Puneri Safar | पुणेरी सफर",
  description:
    "Explore, experience and navigate Pune - smarter and safer. Context-aware city guidance with verified road safety audits and civic transparency.",
  keywords: ["Pune", "Puneri Safar", "Pune road safety", "Pune heritage", "Pune travel"],
  authors: [{ name: "Puneri Safar Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mukta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ground text-ink font-sans">
        <SkipLink targetId="main-content" label="Skip to main content" />
        <Header />
        <main id="main-content" tabIndex={-1} role="main" className="flex-1 flex flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
