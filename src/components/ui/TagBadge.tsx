import type { Tag } from "@/data/tipos";
import {readableTagForeground} from "@/lib/accessibility/contrast";
import { TagIcone } from "@/components/ui/TagIcone";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold leading-none"
      style={{ backgroundColor: tag.cor_fundo, color: readableTagForeground(tag.cor_fundo,tag.cor_texto) }}
    >
      <TagIcone nome={tag.nome} icone={tag.icone} variante="glifo" />
      {tag.nome}
    </span>
  );
}
