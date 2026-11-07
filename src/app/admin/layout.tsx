import type { Metadata, Viewport } from "next";
import { AdminPwa } from "@/components/admin/pwa/AdminPwa";
import { EARLY_CAPTURE_SCRIPT } from "@/lib/pwa/install";

/**
 * Painel instalável como app no celular (PWA): manifesto, ícone do iPhone e cor
 * da barra valem para todo /admin (inclusive login e verificação em 2 etapas).
 */
export const metadata: Metadata = {
  manifest: "/pwa/admin.webmanifest",
  applicationName: "Donda Admin",
  appleWebApp: { capable: true, title: "Sorvetes Donda", statusBarStyle: "default" },
  icons: { apple: [{ url: "/pwa/admin-apple-180.png", sizes: "180x180" }] },
  formatDetection: { telephone: false },
  // O Next 15 só gera "mobile-web-app-capable"; iPhones antes do iOS 16.4 usam esta.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#C8285F",
  // Deixa a barra de atalhos ocupar até a borda e respeitar a área do gesto do iPhone.
  viewportFit: "cover",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY_CAPTURE_SCRIPT }} />
      <AdminPwa />
      {children}
    </>
  );
}
