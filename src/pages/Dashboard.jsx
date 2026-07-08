import React, { useState } from 'react';
import EmpreendimentoCard from '@/components/dashboard/EmpreendimentoCard';
import ComoAtualizarPanel from '@/components/dashboard/ComoAtualizarPanel';
import SaldoChart from '@/components/dashboard/SaldoChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Archive, Calendar, FileDown, PlusCircle } from 'lucide-react';
import NovoCicloModal from '@/components/dashboard/NovoCicloModal';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

import { gerarPDFGeral } from '@/lib/gerarPDF';
import { usePdfData } from '@/hooks/usePdfData';

export default function Dashboard() {
  const {
    cicloAtivo, saldos, socios, participacoes, allProjetos, despesasProjetos,
    lancamentos, semanas: semanasOrdenadas, empAtivos, empData, acumuladosPorEmp,
    contasAPagarLabel, numSemanasContas, setNumSemanasContas,
  } = usePdfData();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [novoCicloOpen, setNovoCicloOpen] = useState(false);

  const handleArquivar = async () => {
    try {
      await base44.functions.invoke('arquivarVersaoSemanal', {});
      queryClient.invalidateQueries({ queryKey: ['versoesSemanais'] });
      toast({
        title: 'Versão arquivada',
        description: 'A versão da semana foi salva no Histórico com sucesso.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao arquivar',
        description: err?.message || 'Tente novamente.',
      });
      console.error(err);
    }
  };

  const handleGerarPDFGeral = () => {
    try {
      gerarPDFGeral({
        empreendimentos: empAtivos,
        saldos,
        semanas: semanasOrdenadas,
        lancamentos,
        allProjetos,
        despesasProjetos,
        participacoes,
        socios,
        cicloAtivo,
        empData,
        numSemanasContas
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: error?.message || 'Tente novamente.',
      });
    }
  };

  if (!cicloAtivo) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-[20px] font-heading font-bold mb-2">Nenhum ciclo ativo</h2>
        <p className="text-muted-foreground text-[15px]">Vá em Configurações para criar um ciclo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-[28px] font-heading font-bold">Dashboard</h1>
            <div className="flex bg-background rounded border border-border text-[12px]">
              <button
                onClick={() => setNumSemanasContas(4)}
                className={`px-2.5 py-1 rounded-l font-medium transition-colors ${numSemanasContas === 4 ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >04 sem</button>
              <button
                onClick={() => setNumSemanasContas(6)}
                className={`px-2.5 py-1 rounded-r font-medium transition-colors ${numSemanasContas === 6 ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >06 sem</button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="font-heading text-[13px]">{cicloAtivo.nome}</Badge>
            {semanasOrdenadas.length > 0 && semanasOrdenadas[0].data_inicio ? (
              <span className="text-[13px] text-muted-foreground">
                {semanasOrdenadas[0].rotulo} → {semanasOrdenadas[semanasOrdenadas.length-1]?.rotulo}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground italic">Aguardando importação de relatório</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleArquivar} className="gap-2 text-[15px]">
            <Archive className="w-4 h-4" />
            Arquivar versão da semana
          </Button>
          <Button onClick={() => setNovoCicloOpen(true)} className="gap-2 text-[15px] bg-[#AD0000] hover:bg-[#8B0000] text-white">
            <PlusCircle className="w-4 h-4" />
            Novo Ciclo
          </Button>
          <Button variant="outline" onClick={handleGerarPDFGeral} className="gap-2 text-[15px]">
            <FileDown className="w-4 h-4" />
            Gerar PDF Geral
          </Button>
        </div>
      </div>

      <ComoAtualizarPanel />

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
        {empAtivos.map(emp => (
          <EmpreendimentoCard
            key={emp.id}
            emp={emp}
            saldoAtual={empData[emp.id]?.saldoAtual || 0}
            saldoAcumuladoFinal={empData[emp.id]?.saldoAcumuladoFinal || 0}
            contasAPagar={empData[emp.id]?.contasAPagar || 0}
            aporteNecessario={empData[emp.id]?.aporteNecessario || 0}
            temSaldoNegativo={empData[emp.id]?.temSaldoNegativo || false}
            contasAPagarLabel={contasAPagarLabel}
          />
        ))}
      </div>

      {/* Chart */}
      <SaldoChart
        empreendimentos={empAtivos}
        semanas={semanasOrdenadas}
        acumuladosPorEmp={acumuladosPorEmp}
      />

      <NovoCicloModal
        open={novoCicloOpen}
        onOpenChange={setNovoCicloOpen}
        cicloAtivo={cicloAtivo}
      />
    </div>
  );
}