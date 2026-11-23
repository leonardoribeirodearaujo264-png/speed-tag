import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // A rota do PNG lê a arte do cliente de public/placas no servidor.
  outputFileTracingIncludes: {
    "/api/admin/placas/[codigo]/arte": ["./public/placas/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
