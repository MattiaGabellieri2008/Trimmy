import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  title: "Trimmy | Gestionale & Prenotazioni Saloni",
  description: "Piattaforma all-in-one per la gestione del salone, agenda digitale, clienti e prenotazioni online.",
  applicationName: "Trimmy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trimmy",
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="it" 
      suppressHydrationWarning 
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body 
        suppressHydrationWarning 
        className="font-sans text-zinc-900 bg-zinc-50 min-h-full min-h-[100dvh]"
      >
        {children}
      </body>
    </html>
  );
}
