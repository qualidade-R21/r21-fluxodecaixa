import React, { useMemo, useState } from 'react';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
import EmpreendimentoCard from '@/components/dashboard/EmpreendimentoCard';
import SaldoChart from '@/components/dashboard/SaldoChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Archive, Calendar, FileDown, PlusCircle } from 'lucide-react';
import NovoCicloModal from '@/components/dashboard/NovoCicloModal';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useAfacSync } from '@/lib/useAfacSync';
import { gerarPDFGeral } from '@/lib/gerarPDF';
import { useSocios, useParticipacoes } from '@/lib/useFluxoData';

export default function Dashboard() {
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanas } = useSemanas(cicloAtivo?.id);
  const semanaIds = useMemo(() => semanas.map(s => s.id), [semanas]);
  const { data: lancamentos } = useLancamentos(cicloAtivo?.id, semanaIds);
  const { data: saldos } = useSaldos(cicloAtivo?.id);
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);
  const { data: socios } = useSocios();
  const { data: participacoes } = useParticipacoes();
  const [numSemanasContas, setNumSemanasContas] = useState(4);

  // Fetch all projetos internos
  const { data: allProjetos } = useProjetosInternos(
    empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos')?.id
  );

  const semanasOrdenadas = useMemo(() => 
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  const empAtivos = useMemo(() => 
    empreendimentos.filter(e => e.ativo !== false), [empreendimentos]
  );

  // Sincroniza despesa_afac do RIC e GTR automaticamente
  useAfacSync({
    empreendimentos: empAtivos,
    lancamentos,
    saldos,
    semanas: semanasOrdenadas,
    socios,
    participacoes,
    projetos: allProjetos,
    despesasProjetos,
  });

  // Pre-compute data per empreendimento
  const empData = useMemo(() => {
    const data = {};
    empAtivos.forEach(emp => {
      const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
      const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
      const projetos = emp.tipo_fluxo === 'multi_projetos' ? allProjetos : [];

      // Despesas por semana para multi_projetos
      const despPorSemana = {};
      if (emp.tipo_fluxo === 'multi_projetos') {
        const projetoIds = projetos.map(p => p.id);
        semanasOrdenadas.forEach(s => {
          despPorSemana[s.id] = despesasProjetos
            .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
            .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
        });
      }

      const acumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, semanasOrdenadas, despPorSemana, projetos);
      const contasAPagar = calcContasAPagar(empLancs, semanasOrdenadas, despPorSemana, numSemanasContas);
      
      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
        saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }

      const aporteNecessario = (emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos')
        ? calcAporteTotalNecessario(contasAPagar, saldoAtual, emp.margem_aporte_total || 0)
        : 0;

      const lastSemana = semanasOrdenadas[semanasOrdenadas.length - 1];
      const saldoAcumuladoFinal = lastSemana ? (acumulados[lastSemana.id] || 0) : 0;
      const temSaldoNegativo = Object.values(acumulados).some(v => v < 0);

      data[emp.id] = {
        saldoAtual,
        saldoAcumuladoFinal,
        contasAPagar,
        aporteNecessario,
        temSaldoNegativo,
        acumulados
      };
    });
    return data;
  }, [empAtivos, lancamentos, saldos, semanasOrdenadas, allProjetos, despesasProjetos, numSemanasContas]);

  const acumuladosPorEmp = useMemo(() => {
    const result = {};
    Object.keys(empData).forEach(id => {
      result[id] = empData[id].acumulados;
    });
    return result;
  }, [empData]);

  const contasAPagarLabel = useMemo(() => {
    const idx = Math.min(numSemanasContas, semanasOrdenadas.length) - 1;
    if (idx < 0) return 'Contas à Pagar';
    const dataFim = semanasOrdenadas[idx]?.data_fim;
    if (!dataFim) return 'Contas à Pagar';
    const [y, m, d] = dataFim.split('-');
    return `Contas à pagar até ${d}/${m}`;
  }, [numSemanasContas, semanasOrdenadas]);

  const queryClient = useQueryClient();
  const [novoCicloOpen, setNovoCicloOpen] = useState(false);

  const handleArquivar = async () => {
    try {
      await base44.functions.invoke('arquivarVersaoSemanal', {});
      queryClient.invalidateQueries({ queryKey: ['versoesSemanais'] });
    } catch (err) {
      // error will bubble
    }
  };

  const handleGerarPDFGeral = () => {
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
      empData
    });
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
            <span className="text-[13px] text-muted-foreground">
              {semanasOrdenadas.length > 0 && `${semanasOrdenadas[0].rotulo} → ${semanasOrdenadas[semanasOrdenadas.length-1]?.rotulo}`}
            </span>
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
        dataInicioAtual={semanasOrdenadas[0]?.data_inicio}
      />
    </div>
  );
}