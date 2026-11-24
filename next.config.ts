import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      { source: "/admin/login", destination: "/admin/entrar", permanent: false },
      // Telas antigas do painel do cliente e de administradores (links salvos e favoritos).
      { source: "/painel", destination: "/painel/empresas", permanent: false },
      { source: "/painel/inicio", destination: "/painel/empresas", permanent: false },
      { source: "/admin/administradores", destination: "/admin/usuarios", permanent: false },
    ];
  },
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
