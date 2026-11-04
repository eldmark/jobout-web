import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { t } from "@/lib/messages";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["700"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: t("brand.name"),
  description: t("brand.description"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sora.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
