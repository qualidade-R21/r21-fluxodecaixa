import { useMemo, useState } from 'react';
import {
  useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos,
  useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos
} from '@/lib/useFluxoData';
import {
  calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario,
  calcEqualizacao, calcFatorRateio, calcAportesPorSemana
} from '@/lib/calculos';

export function usePdfData() {
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

  const { data: allProjetos } = useProjetosInternos(
    empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos')?.id
  );

  const semanasOrdenadas = useMemo(() =>
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  const empAtivos = useMemo(() =>
    empreendimentos.filter(e => e.ativo !== false), [empreendimentos]
  );

  const gcEmp = useMemo(() =>
    empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos'), [empreendimentos]
  );
  const gtrEmp = useMemo(() =>
    empreendimentos.find(e => e.tipo_fluxo === 'master'), [empreendimentos]
  );
  const ricEmpByName = useMemo(() =>
    empreendimentos.find(e => (e.nome || '').toLowerCase().includes('ric')), [empreendimentos]
  );

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

  const ricSaldoDefaults = useMemo(() => {
    if (!gtrEmp || !ricEmpByName) return {};
    const hasAfac = Object.keys(afacDefaults).length > 0;
    const ricLancsRaw = lancamentos.filter(l => l.empreendimento_id === ricEmpByName.id);
    const ricLancs = ricLancsRaw.map(l => {
      if (hasAfac && (l.despesa_afac || 0) === 0) {
        return { ...l, despesa_afac: afacDefaults[l.semana_id] || 0 };
      }
      return l;
    });
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

  const empData = useMemo(() => {
    const data = {};
    empAtivos.forEach(emp => {
      const empLancs = lancamentosEffective.filter(l => l.empreendimento_id === emp.id);
      const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
      const projetos = emp.tipo_fluxo === 'multi_projetos' ? allProjetos : [];

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

  return {
    empreendimentos,
    cicloAtivo,
    semanas: semanasOrdenadas,
    saldos,
    socios,
    participacoes,
    allProjetos,
    despesasProjetos,
    lancamentos: lancamentosEffective,
    empAtivos,
    empData,
    acumuladosPorEmp,
    contasAPagarLabel,
    numSemanasContas,
    setNumSemanasContas,
  };
}