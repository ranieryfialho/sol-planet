import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { sunState } from "@/lib/sun";
import { THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Solar · Monitoramento",
  description: "Monitoramento das placas solares",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dcebfa" },
    { media: "(prefers-color-scheme: dark)", color: "#16213d" },
  ],
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // o tema segue o sol da usina (ThemeSync grava o cookie); sem cookie ainda, 6h–18h
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = saved === "dark" || saved === "light" ? saved : sunState(null).isDay ? "light" : "dark";
  return (
    <html lang="pt-BR" className={jakarta.variable} data-theme={theme} suppressHydrationWarning>
      <head>
        {/* display=block de propósito: o ícone não pode piscar como texto antes da fonte carregar */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
