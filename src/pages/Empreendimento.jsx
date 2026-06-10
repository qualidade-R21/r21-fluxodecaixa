import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
import TabelaSemanas from '@/components/empreendimento/TabelaSemanas';
import TabelaMultiProjetos from '@/components/empreendimento/TabelaMultiProjetos';
import Indicadores from '@/components/empreendimento/Indicadores';
import AportesSection from '@/components/empreendimento/AportesSection';
import ImportacaoSienge from '@/components/empreendimento/ImportacaoSienge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Empreendimento() {
  const { id } = useParams();
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanas } = useSemanas(cicloAtivo?.id);
  const semanaIds = useMemo(() => semanas.map(s => s.id), [semanas]);
  const { data: lancamentos } = useLancamentos(cicloAtivo?.id, semanaIds);
  const { data: saldos } = useSaldos(cicloAtivo?.id);
  const { data: socios } = useSocios();
  const { data: participacoes } = useParticipacoes();

  const emp = empreendimentos.find(e => e.id === id);
  const { data: projetos } = useProjetosInternos(emp?.tipo_fluxo === 'multi_projetos' ? emp?.id : null);
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);

  const semanasOrdenadas = useMemo(() =>
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  const saldoEmp = saldos.find(s => s.empreendimento_id === id);
  const empLancs = lancamentos.filter(l => l.empreendimento_id === id);

  // Despesas por semana para multi_projetos
  const despPorSemana = useMemo(() => {
    if (emp?.tipo_fluxo !== 'multi_projetos') return {};
    const projetoIds = projetos.map(p => p.id);
    const result = {};
    semanasOrdenadas.forEach(s => {
      result[s.id] = despesasProjetos
        .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
        .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
    });
    return result;
  }, [emp, projetos, despesasProjetos, semanasOrdenadas]);

  const acumulados = useMemo(() =>
    calcSaldosAcumulados(empLancs, emp || {}, saldoEmp, semanasOrdenadas, despPorSemana, projetos),
    [empLancs, emp, saldoEmp, semanasOrdenadas, despPorSemana, projetos]
  );

  const contasAPagar = useMemo(() =>
    calcContasAPagar(empLancs, semanasOrdenadas, despPorSemana),
    [empLancs, semanasOrdenadas, despPorSemana]
  );

  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp?.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
    saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }

  const aporteNecessario = (emp?.tipo_fluxo === 'com_aportes' || emp?.tipo_fluxo === 'multi_projetos')
    ? calcAporteTotalNecessario(contasAPagar, saldoAtual, emp?.margem_aporte_total || 0)
    : 0;

  if (!emp) {
    return (
      <div className="flex flex-col items-center py-20">
        <p className="text-muted-foreground">Empreendimento não encontrado.</p>
        <Link to="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-foreground rounded flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold">{emp.nome}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize font-heading">{emp.tipo_fluxo.replace('_', ' ')}</Badge>
              {emp.banco_principal && <span className="text-xs text-muted-foreground">{emp.banco_principal}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <Indicadores
        emp={emp}
        saldoEmp={saldoEmp}
        contasAPagar={contasAPagar}
        aporteNecessario={aporteNecessario}
        cicloId={cicloAtivo?.id}
      />

      {/* Importação Sienge */}
      <ImportacaoSienge
        emp={emp}
        semanas={semanasOrdenadas}
        lancamentos={empLancs}
        cicloId={cicloAtivo?.id}
      />

      {/* Tabela Semanal */}
      {emp.tipo_fluxo === 'multi_projetos' ? (
        <TabelaMultiProjetos
          emp={emp}
          semanas={semanasOrdenadas}
          projetos={projetos}
          despesasProjetos={despesasProjetos}
          acumulados={acumulados}
        />
      ) : (
        <TabelaSemanas
          emp={emp}
          semanas={semanasOrdenadas}
          lancamentos={empLancs}
          saldoEmp={saldoEmp}
          acumulados={acumulados}
        />
      )}

      {/* Aportes */}
      <AportesSection
        emp={emp}
        semanas={semanasOrdenadas}
        lancamentos={lancamentos}
        saldoEmp={saldoEmp}
        participacoes={participacoes}
        socios={socios}
        despesasPorSemana={despPorSemana}
        projetosInternos={projetos}
      />
    </div>
  );
}