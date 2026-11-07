import { permanentRedirect } from "next/navigation";

// A página de promoções foi removida: as promoções aparecem no cardápio
// (mini tag no produto ou no topo, se o admin escolher a tag de promoção).
export default function Promocoes() {
  permanentRedirect("/");
}
