import { getCustomerSession } from "@/lib/customer-session.server";
import type { Metadata } from "next";
import { Bebas_Neue, Inter, Poppins } from "next/font/google";
import "@/styles.css";
import { Providers } from "./providers";
import { RouteConditionalLayout } from "@/components/layout/RouteConditionalLayout";

const inter = Inter({ subsets: ["latin"] });
// Fontes do cardápio (classes font-cardapio / font-titulo em styles.css).
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sorvetes Donda — Delivery online",
  description: "Peça seu sorvete online na Sorvetes Donda.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialCliente = await getCustomerSession().catch(() => undefined);
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} ${poppins.variable} ${bebasNeue.variable}`}>
        <Providers initialCliente={initialCliente}>
          <RouteConditionalLayout>{children}</RouteConditionalLayout>
        </Providers>
      </body>
    </html>
  );
}
