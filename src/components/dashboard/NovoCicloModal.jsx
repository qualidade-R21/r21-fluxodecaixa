import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, Archive, AlertTriangle } from 'lucide-react';

export default function NovoCicloModal({ open, onOpenChange, cicloAtivo }) {
  const [step, setStep] = useState(1);
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [nome, setNome] = useState('');
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  // Check if a version was already archived for the current cycle today
  const { data: versoesExistentes, isLoading: versoesLoading } = useQuery({
    queryKey: ['versoes-ciclo-atual', cicloAtivo?.id],
    queryFn: async () => {
      if (!cicloAtivo) return [];
      const all = await base44.entities.VersaoSemanal.list('-created_date', 50);
      return all.filter(v => v.ciclo_id === cicloAtivo.id);
    },
    enabled: open && !!cicloAtivo,
  });

  const hoje = new Date().toISOString().split('T')[0];
  const jaArquivadoHoje = (versoesExistentes || []).some(v => v.data_referencia === hoje);

  const reset = () => {
    setStep(1);
    setArchiving(false);
    setArchived(false);
    setNome('');
    setCreating(false);
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await base44.functions.invoke('arquivarVersaoSemanal', {});
      setArchived(true);
    } catch (err) {
      setArchiving(false);
      throw err;
    }
    setArchiving(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    await base44.functions.invoke('criarNovoCiclo', { nome });
    qc.invalidateQueries();
    reset();
    onOpenChange(false);
  };

  const handleOpen = (isOpen) => {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg flex items-center gap-2">
                <Archive className="w-5 h-5" />
                Arquivar ciclo atual
              </DialogTitle>
              <DialogDescription className="text-[15px] pt-3">
                {jaArquivadoHoje
                  ? <>A versão do ciclo <strong>{cicloAtivo?.nome}</strong> já foi arquivada hoje. Não é necessário arquivar novamente.</>
                  : <>Antes de criar um novo ciclo, o sistema vai arquivar automaticamente uma versão completa do ciclo atual <strong>{cicloAtivo?.nome}</strong> no Histórico. Todos os dados atuais ficarão preservados para consulta futura.</>
                }
              </DialogDescription>
            </DialogHeader>

            {versoesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : jaArquivadoHoje ? (
              <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-green-800 text-[13px] mt-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Versão já arquivada hoje — você pode prosseguir para o novo ciclo sem duplicar o registro.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800 text-[13px] mt-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Lembre-se: se você já arquivou manualmente a versão desta semana, não é necessário arquivar novamente aqui.</span>
              </div>
            )}

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
              {jaArquivadoHoje ? (
                <Button onClick={() => setStep(2)} className="gap-2">
                  Continuar para Novo Ciclo
                </Button>
              ) : (
                <Button
                  onClick={archived ? (() => setStep(2)) : handleArchive}
                  disabled={archiving}
                  className="gap-2"
                >
                  {archiving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Arquivando...</>
                  ) : archived ? (
                    <><CheckCircle2 className="w-4 h-4 text-green-500" /> Versão arquivada — Próximo</>
                  ) : (
                    <><Archive className="w-4 h-4" /> Arquivar e continuar</>
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Novo Ciclo</DialogTitle>
              <DialogDescription className="text-[15px] pt-3">
                Os lançamentos semanais de todos os empreendimentos iniciarão em{" "}
                <strong>zero</strong>. Saldos bancários, dados societários e projetos
                internos serão mantidos com os valores atuais.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-[13px]">Nome do ciclo</Label>
                <Input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Julho–Agosto 2026"
                  className="mt-1.5"
                />
                <p className="text-[12px] text-muted-foreground mt-2">
                  As datas das semanas serão definidas automaticamente ao importar o primeiro relatório.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button
                onClick={handleCreate}
                disabled={!nome || creating}
                className="gap-2 bg-[#AD0000] hover:bg-[#8B0000] text-white"
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Criando ciclo...</>
                ) : (
                  'Criar Ciclo'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}