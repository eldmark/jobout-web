import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobOut",
  description: "Preparate, practicá y llegá listo a la entrevista.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
