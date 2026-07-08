import React, { useMemo, useState } from 'react';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario, calcEqualizacao, calcFatorRateio, calcAportesPorSemana } from '@/lib/calculos';
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

  // GC (multi_projetos) and GTR (master) and RIC (by name)
  const gcEmp = useMemo(() =>
    empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos'), [empreendimentos]
  );
  const gtrEmp = useMemo(() =>
    empreendimentos.find(e => e.tipo_fluxo === 'master'), [empreendimentos]
  );
  const ricEmpByName = useMemo(() =>
    empreendimentos.find(e => (e.nome || '').toLowerCase().includes('ric')), [empreendimentos]
  );

  // AFAC defaults: GC's RIC sócio aporte per week (fills despesa_afac for empreendimentos with despesa_dividida_r21)
  const afacDefaults = useMemo(() => {
    if (!gcEmp) return {};
    const gcLancs = lancamentos.filter(l => l.empreendimento_id === gcEmp.id);
    const gcSaldo = saldos.find(s => s.empreendimento_id === gcEmp.id);
    const gcParts = participacoes.filter(p => p.empreendimento_id === gcEmp.id);
    const gcProjetos = allProjetos;
    const gcProjetoIds = gcProjetos.map(p => p.id);
    const gcDespPorSemana = {};
    semanasOrdenadas.forEach(s => {
      gcDespPorSemana[s.id] = despesasProjetos
        .filter(d => gcProjetoIds.includes(d.projeto_id) && d.semana_id === s.id)
        .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
    });
    const gcAcumulados = calcSaldosAcumulados(gcLancs, gcEmp, gcSaldo, semanasOrdenadas, gcDespPorSemana, gcProjetos);
    let gcSaldoAtual = gcSaldo?.saldo_atual || 0;
    if (gcProjetos.length > 0) gcSaldoAtual = gcProjetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
    const gcContasAPagar = calcContasAPagar(gcLancs, semanasOrdenadas, gcEmp, gcDespPorSemana, 4);
    const gcAporteTotal = calcAporteTotalNecessario(gcContasAPagar, gcSaldoAtual, gcEmp.margem_aporte_total || 0);
    const gcEqualizacao = calcEqualizacao(gcParts, gcAporteTotal, gcEmp, socios);
    const gcEqComFator = calcFatorRateio(gcEqualizacao, gcAporteTotal);
    const gcAportesSemana = calcAportesPorSemana(gcLancs, gcEmp, gcSaldo, semanasOrdenadas, gcEqComFator, gcDespPorSemana, gcProjetos, gcAcumulados);
    const ricSocio = socios.find(s => s.nome.toLowerCase().includes('ric'));
    if (!ricSocio) return {};
    const defaults = {};
    semanasOrdenadas.forEach(s => { defaults[s.id] = gcAportesSemana[s.id]?.porSocio[ricSocio.id] || 0; });
    return defaults;
  }, [gcEmp, lancamentos, saldos, participacoes, allProjetos, despesasProjetos, semanasOrdenadas, socios]);

  // RIC saldo defaults: RIC's negative saldo acumulado (fills despesa_prevista for GTR/master)
  const ricSaldoDefaults = useMemo(() => {
    if (!gtrEmp || !ricEmpByName) return {};
    const hasAfac = Object.keys(afacDefaults).length > 0;
    const ricLancsRaw = lancamentos.filter(l => l.empreendimento_id === ricEmpByName.id);
    // Apply afac defaults to RIC's lancamentos before computing acumulados
    const ricLancs = ricLancsRaw.map(l => {
      if (hasAfac && (l.despesa_afac || 0) === 0) {
        return { ...l, despesa_afac: afacDefaults[l.semana_id] || 0 };
      }
      return l;
    });
    // Add synthetic records for missing weeks
    if (hasAfac) {
      const existingRicWeeks = new Set(ricLancsRaw.map(l => l.semana_id));
      semanasOrdenadas.forEach(s => {
        if (!existingRicWeeks.has(s.id)) {
          ricLancs.push({ empreendimento_id: ricEmpByName.id, semana_id: s.id, despesa_afac: afacDefaults[s.id] || 0 });
        }
      });
    }
    const ricSaldo = saldos.find(s => s.empreendimento_id === ricEmpByName.id);
    const ricAcumulados = calcSaldosAcumulados(ricLancs, ricEmpByName, ricSaldo, semanasOrdenadas, {}, []);
    const defaults = {};
    semanasOrdenadas.forEach(s => {
      const saldo = ricAcumulados[s.id] || 0;
      defaults[s.id] = saldo < 0 ? saldo : 0;
    });
    return defaults;
  }, [gtrEmp, ricEmpByName, lancamentos, saldos, semanasOrdenadas, afacDefaults]);

  const lancamentosEffective = useMemo(() => {
    const hasAfac = Object.keys(afacDefaults).length > 0;
    const hasRic = Object.keys(ricSaldoDefaults).length > 0;
    if (!hasAfac && !hasRic) return lancamentos;
    const result = lancamentos.map(l => {
      let res = l;
      if (hasAfac && !res.afac_override) {
        const emp = empreendimentos.find(e => e.id === l.empreendimento_id);
        if (emp?.despesa_dividida_r21 && (res.despesa_afac || 0) === 0) {
          res = { ...res, despesa_afac: afacDefaults[l.semana_id] || 0 };
        }
      }
      if (hasRic && gtrEmp && l.empreendimento_id === gtrEmp.id && !res.afac_override && (res.despesa_prevista || 0) === 0) {
        res = { ...res, despesa_prevista: ricSaldoDefaults[l.semana_id] || 0 };
      }
      return res;
    });
    // Add synthetic GTR records for weeks without a lancamento
    if (hasRic && gtrEmp) {
      const existingGtrWeeks = new Set(lancamentos.filter(l => l.empreendimento_id === gtrEmp.id).map(l => l.semana_id));
      semanasOrdenadas.forEach(s => {
        if (!existingGtrWeeks.has(s.id)) {
          const synth = { empreendimento_id: gtrEmp.id, semana_id: s.id };
          synth.despesa_prevista = ricSaldoDefaults[s.id] || 0;
          result.push(synth);
        }
      });
    }
    return result;
  }, [lancamentos, afacDefaults, ricSaldoDefaults, empreendimentos, gtrEmp, semanasOrdenadas]);

  // Pre-compute data per empreendimento
  const empData = useMemo(() => {
    const data = {};
    empAtivos.forEach(emp => {
      const empLancs = lancamentosEffective.filter(l => l.empreendimento_id === emp.id);
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
      const contasAPagar = calcContasAPagar(empLancs, semanasOrdenadas, emp, despPorSemana, numSemanasContas);
      
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
  }, [empAtivos, lancamentosEffective, saldos, semanasOrdenadas, allProjetos, despesasProjetos, numSemanasContas]);

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
        lancamentos: lancamentosEffective,
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