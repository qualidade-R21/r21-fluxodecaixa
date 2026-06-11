// Hook que mantém sincronizado o campo despesa_afac dos empreendimentos RIC e GTR
// RIC.despesa_afac[semana] = aporte semanal do sócio RIC no Grupo GC
// GTR.despesa_afac[semana] = Saldo Acumulado do RIC na semana (se negativo; senão 0)
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calcEqualizacao, calcFatorRateio, calcAportesPorSemana, calcSaldosAcumulados } from './calculos';

function computeAportes(emp, empLancs, saldoEmp, semanas, participacoes, despPorSemana = {}, projetos = []) {
  if (!emp) return {};
  const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
  if (empParts.length === 0) return {};

  let contasAPagar = 0;
  for (let i = 0; i < Math.min(4, semanas.length); i++) {
    const s = semanas[i];
    const lanc = empLancs.find(l => l.semana_id === s.id) || {};
    const dp = despPorSemana[s.id] || 0;
    contasAPagar += (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0) + (lanc.despesa_r21 || 0) + (lanc.despesa_afac || 0) + dp;
  }

  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
    saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }

  const aporteTotal = contasAPagar > saldoAtual ? contasAPagar - saldoAtual + (emp.margem_aporte_total || 0) : 0;
  const eq = calcEqualizacao(empParts, aporteTotal);
  const eqF = calcFatorRateio(eq);
  const acumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, semanas, despPorSemana, projetos);
  return calcAportesPorSemana(empLancs, emp, saldoEmp, semanas, eqF, despPorSemana, projetos, acumulados);
}

export function useAfacSync({
  empreendimentos, lancamentos, saldos, semanas,
  socios, participacoes, projetos, despesasProjetos
}) {
  const qc = useQueryClient();
  const lastAfacRef = useRef({});

  useEffect(() => {
    if (!empreendimentos.length || !semanas.length || !socios.length) return;

    const soloGC = empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos');
    const empGTR = empreendimentos.find(e => e.nome && e.nome.toLowerCase().includes('gtr'));
    const empRIC = empreendimentos.find(e => e.nome && e.nome.toLowerCase().includes('ric') && e.tipo_fluxo !== 'multi_projetos');

    const socioRIC = socios.find(s => s.nome === 'RIC');

    if (!soloGC || !empGTR || !empRIC || !socioRIC) return;

    // 1. Calcular aportes GC → RIC afac
    const gcLancs = lancamentos.filter(l => l.empreendimento_id === soloGC.id);
    const gcSaldo = saldos.find(s => s.empreendimento_id === soloGC.id);
    const gcDespPorSemana = {};
    const projetoIds = projetos.map(p => p.id);
    semanas.forEach(s => {
      gcDespPorSemana[s.id] = despesasProjetos
        .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
        .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
    });
    const aportesGC = computeAportes(soloGC, gcLancs, gcSaldo, semanas, participacoes, gcDespPorSemana, projetos);

    // 2. Computar RIC afac e saldos acumulados localmente (para derivar GTR afac)
    const ricLancs = lancamentos.filter(l => l.empreendimento_id === empRIC.id);
    const ricSaldo = saldos.find(s => s.empreendimento_id === empRIC.id);
    const ricLancsUpdated = ricLancs.map(l => ({
      ...l,
      despesa_afac: aportesGC[l.semana_id]?.porSocio[socioRIC.id] || 0
    }));
    const ricAcumulados = calcSaldosAcumulados(ricLancsUpdated, empRIC, ricSaldo, semanas, {}, []);

    // 3. GTR afac = RIC saldo acumulado (quando negativo)
    const newAfac = {};
    semanas.forEach(s => {
      const ricSaldoAcum = ricAcumulados[s.id] || 0;
      newAfac[`gtr_${s.id}`] = ricSaldoAcum < 0 ? ricSaldoAcum : 0;
      newAfac[`ric_${s.id}`] = aportesGC[s.id]?.porSocio[socioRIC.id] || 0;
    });

    // Check if anything changed
    const changed = JSON.stringify(newAfac) !== JSON.stringify(lastAfacRef.current);
    if (!changed) return;
    lastAfacRef.current = newAfac;

    // Update lancamentos asynchronously
    const updateAfac = async () => {
      let dirty = false;

      for (const semana of semanas) {
        // GTR afac (vem do RIC)
        const afacGTR = newAfac[`gtr_${semana.id}`];
        const lancGTR = lancamentos.find(l => l.empreendimento_id === empGTR.id && l.semana_id === semana.id);
        if (Math.abs((lancGTR?.despesa_afac || 0) - afacGTR) > 0.01) {
          if (lancGTR) {
            await base44.entities.LancamentoSemanal.update(lancGTR.id, { despesa_afac: afacGTR });
          } else if (afacGTR !== 0) {
            await base44.entities.LancamentoSemanal.create({ empreendimento_id: empGTR.id, semana_id: semana.id, despesa_afac: afacGTR });
          }
          dirty = true;
        }

        // RIC afac (vem do GC)
        const afacRIC = newAfac[`ric_${semana.id}`];
        const lancRIC = lancamentos.find(l => l.empreendimento_id === empRIC.id && l.semana_id === semana.id);
        if (Math.abs((lancRIC?.despesa_afac || 0) - afacRIC) > 0.01) {
          if (lancRIC) {
            await base44.entities.LancamentoSemanal.update(lancRIC.id, { despesa_afac: afacRIC });
          } else if (afacRIC > 0) {
            await base44.entities.LancamentoSemanal.create({ empreendimento_id: empRIC.id, semana_id: semana.id, despesa_afac: afacRIC });
          }
          dirty = true;
        }
      }

      if (dirty) {
        qc.invalidateQueries({ queryKey: ['lancamentos'] });
      }
    };

    updateAfac();
  }, [empreendimentos, lancamentos, saldos, semanas, socios, participacoes, projetos, despesasProjetos]);
}