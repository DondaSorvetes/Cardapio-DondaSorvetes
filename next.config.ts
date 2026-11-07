import type { NextConfig } from "next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // Versão exibida no rodapé "Desenvolvido por" do perfil.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // Private Storage originals are streamed server-side; Next caches resized variants.
  images: {
    minimumCacheTTL: 2592000,
    imageSizes: [64, 96, 192, 384],
    deviceSizes: [640, 960, 1200, 1920, 2400],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qbckawrirxsvpgzeakii.supabase.co",
        pathname: "/storage/v1/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 90,
      static: 180,
    },
  },
  // Headers adicionais (também aplicados no middleware)
  async headers() {
    return [
      {
        // Service worker do app do painel no celular: fica em /pwa/ mas controla /admin.
        source: "/pwa/admin-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/admin" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/pwa/admin.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
  // Não embutir service role no client bundle
  serverExternalPackages: ["@supabase/supabase-js"],
  poweredByHeader: false,
};

export default nextConfig;
