import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, Archive } from 'lucide-react';

export default function NovoCicloModal({ open, onOpenChange, cicloAtivo }) {
  const [step, setStep] = useState(1);
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const [nome, setNome] = useState('');
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

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
    await base44.functions.invoke('arquivarVersaoSemanal', {});
    setArchiving(false);
    setArchived(true);
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
                Antes de criar um novo ciclo, o sistema vai arquivar automaticamente uma
                versão completa do ciclo atual{" "}
                <strong>{cicloAtivo?.nome}</strong> no
                Histórico. Todos os dados atuais ficarão preservados para consulta futura.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
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