import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario, calcEqualizacao, calcFatorRateio, calcAportesPorSemana } from '@/lib/calculos';

import TabelaSemanas from '@/components/empreendimento/TabelaSemanas';
import TabelaMultiProjetos from '@/components/empreendimento/TabelaMultiProjetos';
import Indicadores from '@/components/empreendimento/Indicadores';
import AportesSection from '@/components/empreendimento/AportesSection';
import ImportacaoSienge from '@/components/empreendimento/ImportacaoSienge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, FileDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { gerarPDFEmpreendimento } from '@/lib/gerarPDF';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

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
  const gcEmpId = useMemo(() => emp?.despesa_dividida_r21 ? empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos')?.id || null : null, [emp, empreendimentos]);
  const { data: gcProjetos } = useProjetosInternos(gcEmpId);
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);

  const semanasOrdenadas = useMemo(() =>
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  const saldoEmp = saldos.find(s => s.empreendimento_id === id);

  // AFAC defaults from Green Concept's RIC aporte (for RIC Participações)
  const afacDefaults = useMemo(() => {
    if (!emp?.despesa_dividida_r21 || !gcEmpId) return {};
    const gcEmp = empreendimentos.find(e => e.id === gcEmpId);
    if (!gcEmp) return {};
    const gcLancs = lancamentos.filter(l => l.empreendimento_id === gcEmpId);
    const gcSaldo = saldos.find(s => s.empreendimento_id === gcEmpId);
    const gcParts = participacoes.filter(p => p.empreendimento_id === gcEmpId);
    const gcDespPorSemana = {};
    const gcProjetoIds = gcProjetos.map(p => p.id);
    semanasOrdenadas.forEach(s => {
      gcDespPorSemana[s.id] = despesasProjetos.filter(d => gcProjetoIds.includes(d.projeto_id) && d.semana_id === s.id).reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
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
  }, [emp, gcEmpId, empreendimentos, lancamentos, saldos, participacoes, socios, gcProjetos, despesasProjetos, semanasOrdenadas]);

  // RIC Saldo Acumulado defaults for GTR's Despesa Prev. (AFAC)
  const ricSaldoDefaults = useMemo(() => {
    if (!emp || emp.tipo_fluxo !== 'master') return {};
    const ricEmp = empreendimentos.find(e => (e.nome || '').toLowerCase().includes('ric'));
    if (!ricEmp) return {};
    const ricLancs = lancamentos.filter(l => l.empreendimento_id === ricEmp.id);
    const ricSaldo = saldos.find(s => s.empreendimento_id === ricEmp.id);
    const ricAcumulados = calcSaldosAcumulados(ricLancs, ricEmp, ricSaldo, semanasOrdenadas, {}, []);
    const defaults = {};
    semanasOrdenadas.forEach(s => {
      const saldo = ricAcumulados[s.id] || 0;
      defaults[s.id] = saldo < 0 ? saldo : 0;
    });
    return defaults;
  }, [emp, empreendimentos, lancamentos, saldos, semanasOrdenadas]);

  const lancamentosEffective = useMemo(() => {
    const hasAfac = Object.keys(afacDefaults).length > 0;
    const hasRic = Object.keys(ricSaldoDefaults).length > 0;
    if (!hasAfac && !hasRic) return lancamentos;
    return lancamentos.map(l => {
      if (l.empreendimento_id !== id) return l;
      let result = l;
      if (hasAfac && (result.despesa_afac || 0) === 0) {
        result = { ...result, despesa_afac: afacDefaults[l.semana_id] || 0 };
      }
      if (hasRic && (result.despesa_prevista || 0) === 0) {
        result = { ...result, despesa_prevista: ricSaldoDefaults[l.semana_id] || 0 };
      }
      return result;
    });
  }, [lancamentos, afacDefaults, ricSaldoDefaults, id]);

  const empLancs = lancamentosEffective.filter(l => l.empreendimento_id === id);

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

  const [numSemanasContas, setNumSemanasContas] = useState(4);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { toast } = useToast();

  const contasAPagar = useMemo(() =>
    calcContasAPagar(empLancs, semanasOrdenadas, emp || {}, despPorSemana, numSemanasContas),
    [empLancs, semanasOrdenadas, despPorSemana, numSemanasContas]
  );

  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp?.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
    saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }

  const aporteNecessario = (emp?.tipo_fluxo === 'com_aportes' || emp?.tipo_fluxo === 'multi_projetos')
    ? calcAporteTotalNecessario(contasAPagar, saldoAtual, emp?.margem_aporte_total || 0)
    : 0;

  const handleGerarPDF = async () => {
    setPdfLoading(true);
    try {
      const { arrayBuffer, fileName } = gerarPDFEmpreendimento({
        emp,
        saldoEmp,
        semanas: semanasOrdenadas,
        lancamentos: empLancs,
        projetos,
        despesasProjetos,
        acumulados,
        contasAPagar,
        aporteNecessario,
        participacoes,
        socios,
        cicloAtivo
      });

      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const reportPdfBase64 = btoa(binary);

      const response = await base44.functions.invoke('gerarPDFComAnexos', {
        empreendimento_id: id,
        ciclo_id: cicloAtivo?.id,
        reportPdfBase64,
        empreendimento_nome: emp.nome,
        ciclo_nome: cicloAtivo?.nome
      });

      const byteChars = atob(response.data.pdfBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.fileName || fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: error?.response?.data?.error || error?.message || 'Tente novamente.',
      });
    } finally {
      setPdfLoading(false);
    }
  };

  if (!emp) {
    return (
      <div className="flex flex-col items-center py-20">
        <p className="text-muted-foreground">Empreendimento não encontrado.</p>
        <Link to="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />Voltar</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 bg-foreground rounded flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-[28px] font-heading font-bold leading-tight">{emp.nome}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[13px] capitalize font-heading">{emp.tipo_fluxo.replace('_', ' ')}</Badge>
              {emp.banco_principal && <span className="text-[13px] text-muted-foreground">{emp.banco_principal}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleGerarPDF} disabled={pdfLoading} className="gap-2 shrink-0 text-[15px]">
          {pdfLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Gerar PDF
            </>
          )}
        </Button>
      </div>

      {/* Indicadores */}
      <Indicadores
        emp={emp}
        saldoEmp={saldoEmp}
        contasAPagar={contasAPagar}
        aporteNecessario={aporteNecessario}
        cicloId={cicloAtivo?.id}
        numSemanasContas={numSemanasContas}
        onNumSemanasChange={setNumSemanasContas}
        saldoAtualOverride={emp?.tipo_fluxo === 'multi_projetos' ? saldoAtual : undefined}
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
        lancamentos={lancamentosEffective}
        saldoEmp={saldoEmp}
        participacoes={participacoes}
        socios={socios}
        despesasPorSemana={despPorSemana}
        projetosInternos={projetos}
        acumulados={acumulados}
      />
    </div>
  );
}