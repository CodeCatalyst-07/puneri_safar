import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SkipLink, Header, Footer } from "@/components";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0369a1",
};

export const metadata: Metadata = {
  title: "Puneri Safar | Explore, experience and navigate Pune - smarter and safer",
  description:
    "Explore, experience and navigate Pune - smarter and safer. A context-aware city assistant for Pune, India covering exploration, heritage, safety, place comparison, and smart insights.",
  keywords: [
    "Pune",
    "Puneri Safar",
    "Pune exploration",
    "Pune heritage",
    "Pune safety",
    "Pune traffic",
    "Pune monsoon",
  ],
  authors: [{ name: "Puneri Safar Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SkipLink targetId="main-content" label="Skip to main content" />
        <Header />
        <main id="main-content" tabIndex={-1} role="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
