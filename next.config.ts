import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necesario para la imagen de producción: copia solo lo que el servidor usa
  output: "standalone",
};

export default nextConfig;
