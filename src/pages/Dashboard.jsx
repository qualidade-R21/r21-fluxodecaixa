import React, { useMemo } from 'react';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
import EmpreendimentoCard from '@/components/dashboard/EmpreendimentoCard';
import SaldoChart from '@/components/dashboard/SaldoChart';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

export default function Dashboard() {
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanas } = useSemanas(cicloAtivo?.id);
  const semanaIds = useMemo(() => semanas.map(s => s.id), [semanas]);
  const { data: lancamentos } = useLancamentos(cicloAtivo?.id, semanaIds);
  const { data: saldos } = useSaldos(cicloAtivo?.id);
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);

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
      const contasAPagar = calcContasAPagar(empLancs, semanasOrdenadas, despPorSemana);
      
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
  }, [empAtivos, lancamentos, saldos, semanasOrdenadas, allProjetos, despesasProjetos]);

  const acumuladosPorEmp = useMemo(() => {
    const result = {};
    Object.keys(empData).forEach(id => {
      result[id] = empData[id].acumulados;
    });
    return result;
  }, [empData]);

  if (!cicloAtivo) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-heading font-bold mb-2">Nenhum ciclo ativo</h2>
        <p className="text-muted-foreground text-sm">Vá em Configurações para criar um ciclo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="font-heading text-xs">{cicloAtivo.nome}</Badge>
            <span className="text-xs text-muted-foreground">
              {semanasOrdenadas.length > 0 && `${semanasOrdenadas[0].rotulo} → ${semanasOrdenadas[semanasOrdenadas.length-1]?.rotulo}`}
            </span>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {empAtivos.map(emp => (
          <EmpreendimentoCard
            key={emp.id}
            emp={emp}
            saldoAtual={empData[emp.id]?.saldoAtual || 0}
            saldoAcumuladoFinal={empData[emp.id]?.saldoAcumuladoFinal || 0}
            contasAPagar={empData[emp.id]?.contasAPagar || 0}
            aporteNecessario={empData[emp.id]?.aporteNecessario || 0}
            temSaldoNegativo={empData[emp.id]?.temSaldoNegativo || false}
          />
        ))}
      </div>

      {/* Chart */}
      <SaldoChart
        empreendimentos={empAtivos}
        semanas={semanasOrdenadas}
        acumuladosPorEmp={acumuladosPorEmp}
      />
    </div>
  );
}