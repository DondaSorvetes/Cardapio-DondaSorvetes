'use client';

import { useState } from 'react';
import type { Endereco } from '@/types/endereco';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ListaEnderecosProps {
  enderecos: Endereco[];
  onSelecionarEndereco?: (endereco: Endereco) => void;
  modoSelecao?: boolean; // Se true, mostra botões de seleção
  enderecoSelecionadoId?: string;
}

export function ListaEnderecos({
  enderecos,
  onSelecionarEndereco,
  modoSelecao = false,
  enderecoSelecionadoId,
}: ListaEnderecosProps) {
  const router = useRouter();
  const [carregando, setCarregando] = useState<string | null>(null);

  const handleDefinirPrincipal = async (enderecoId: string) => {
    setCarregando(enderecoId);
    try {
      const resposta = await fetch('/api/enderecos/principal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enderecoId }),
      });

      if (!resposta.ok) {
        toast.error('Erro ao definir endereço principal');
        return;
      }

      toast.success('Endereço principal atualizado!');
      router.refresh();
    } catch {
      toast.error('Erro ao atualizar endereço');
    } finally {
      setCarregando(null);
    }
  };

  const handleRemover = async (enderecoId: string) => {
    if (!confirm('Deseja realmente remover este endereço?')) {
      return;
    }

    setCarregando(enderecoId);
    try {
      const resposta = await fetch('/api/enderecos/remover', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enderecoId }),
      });

      if (!resposta.ok) {
        toast.error('Erro ao remover endereço');
        return;
      }

      toast.success('Endereço removido!');
      router.refresh();
    } catch {
      toast.error('Erro ao remover endereço');
    } finally {
      setCarregando(null);
    }
  };

  if (enderecos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Nenhum endereço cadastrado
          </p>
          <Button
            onClick={() => router.push('/perfil/enderecos/novo')}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Endereço
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {enderecos.map((endereco) => {
        const estaCarregando = carregando === endereco.id;
        const estaSelecionado = enderecoSelecionadoId === endereco.id;

        return (
          <Card
            key={endereco.id}
            className={`transition-all ${
              modoSelecao
                ? estaSelecionado
                  ? 'border-pink-500 border-2 bg-pink-50'
                  : 'hover:border-pink-300 cursor-pointer'
                : ''
            }`}
            onClick={() => {
              if (modoSelecao && onSelecionarEndereco) {
                onSelecionarEndereco(endereco);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-pink-600" />
                    <span className="font-semibold">{endereco.apelido}</span>
                    {endereco.principal && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        Principal
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {endereco.logradouro}
                      {endereco.numero && `, ${endereco.numero}`}
                    </p>
                    {endereco.complemento && <p>{endereco.complemento}</p>}
                    {endereco.bairro && <p>{endereco.bairro}</p>}
                    {(endereco.cidade || endereco.estado) && (
                      <p>
                        {endereco.cidade}
                        {endereco.cidade && endereco.estado && ' - '}
                        {endereco.estado}
                      </p>
                    )}
                    {endereco.cep && (
                      <p className="font-mono">
                        CEP: {endereco.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                      </p>
                    )}
                  </div>
                </div>

                {!modoSelecao && (
                  <div className="flex flex-col gap-2">
                    {!endereco.principal && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDefinirPrincipal(endereco.id)}
                        disabled={estaCarregando}
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemover(endereco.id)}
                      disabled={estaCarregando || enderecos.length === 1}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
