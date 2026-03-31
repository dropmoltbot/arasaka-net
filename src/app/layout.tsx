import type { Metadata } from "next";
import { JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARASAKA-NET // CITY GRID v1.0",
  description: "Corporate city-network visualization. Unauthorized access prohibited.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23050508' width='100' height='100'/><circle cx='50' cy='50' r='20' fill='none' stroke='%2300f5ff' stroke-width='4'/><line x1='50' y1='10' x2='50' y2='90' stroke='%2300f5ff' stroke-width='2'/><line x1='10' y1='50' x2='90' y2='50' stroke='%2300f5ff' stroke-width='2'/></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${orbitron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
