// Utilitários de cálculo do Fluxo de Caixa Semanal R21

export function formatBRL(value) {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// A) Saldo da Semana
export function calcSaldoSemana(lancamento, empreendimento, despesasProjetos = 0) {
  if (empreendimento.tipo_fluxo === 'multi_projetos') {
    return -despesasProjetos;
  }
  const receitas = (lancamento.receita_consolidada || 0) + (lancamento.receita_prevista || 0);
  const despesas = (lancamento.despesa_consolidada || 0) + (lancamento.despesa_prevista || 0) + (lancamento.despesa_afac || 0);
  // despesa_r21 NÃO entra no saldo
  return receitas - despesas;
}

// B) Saldo Acumulado
export function calcSaldosAcumulados(lancamentos, empreendimento, saldoEmp, semanasOrdenadas, despesasProjetosPorSemana = {}, projetosInternos = []) {
  const acumulados = {};
  let anterior = 0;
  
  for (let i = 0; i < semanasOrdenadas.length; i++) {
    const semana = semanasOrdenadas[i];
    const lanc = lancamentos.find(l => l.semana_id === semana.id) || {};
    const despProjetos = despesasProjetosPorSemana[semana.id] || 0;
    const saldoSemana = calcSaldoSemana(lanc, empreendimento, despProjetos);
    
    if (i === 0) {
      let saldoAtual = saldoEmp?.saldo_atual || 0;
      // Grupo GC: saldo_atual = soma dos saldos disponíveis dos projetos internos
      if (empreendimento.tipo_fluxo === 'multi_projetos' && projetosInternos.length > 0) {
        saldoAtual = projetosInternos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }
      const saldoAplicado = empreendimento.tem_saldo_aplicado ? (saldoEmp?.saldo_aplicado || 0) : 0;
      anterior = saldoAtual + saldoAplicado + saldoSemana;
    } else {
      anterior = anterior + saldoSemana;
    }
    acumulados[semana.id] = anterior;
  }
  return acumulados;
}

// C) Contas a Pagar (Mês Atual) - semanas 1 a 4
export function calcContasAPagar(lancamentos, semanasOrdenadas, despesasProjetosPorSemana = {}) {
  let total = 0;
  for (let i = 0; i < Math.min(4, semanasOrdenadas.length); i++) {
    const semana = semanasOrdenadas[i];
    const lanc = lancamentos.find(l => l.semana_id === semana.id) || {};
    const despProjetos = despesasProjetosPorSemana[semana.id] || 0;
    total += (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0) + (lanc.despesa_afac || 0) + despProjetos;
  }
  return total;
}

// D) Aporte Total Necessário
export function calcAporteTotalNecessario(contasAPagar, saldoAtual, margemAporteTotal) {
  if (contasAPagar > saldoAtual) {
    return contasAPagar - saldoAtual + margemAporteTotal;
  }
  return 0;
}

// E) Equalização societária
export function calcEqualizacao(participacoes, aporteTotalNecessario) {
  const totalSaldoADevolver = participacoes.reduce((sum, p) => {
    return sum + ((p.valor_aportado || 0) - (p.valor_devolvido || 0));
  }, 0);

  return participacoes.map(p => {
    const saldoADevolver = (p.valor_aportado || 0) - (p.valor_devolvido || 0);
    const percentualAtual = totalSaldoADevolver > 0 ? saldoADevolver / totalSaldoADevolver : 0;
    const totalParaEqualizar = (totalSaldoADevolver + aporteTotalNecessario) * ((p.percentual_sociedade || 0) / 100);
    const aporteNecessario = totalParaEqualizar - (p.valor_aportado || 0);
    return {
      ...p,
      saldoADevolver,
      percentualAtual,
      totalParaEqualizar,
      aporteNecessario
    };
  });
}

export function calcFatorRateio(equalizacao) {
  const somaAportesNecessarios = equalizacao.reduce((sum, e) => sum + Math.max(0, e.aporteNecessario), 0);
  return equalizacao.map(e => ({
    ...e,
    fatorRateio: somaAportesNecessarios > 0 ? Math.max(0, e.aporteNecessario) / somaAportesNecessarios : 0
  }));
}

// F) Aportes por Semana
export function calcAportesPorSemana(lancamentos, empreendimento, saldoEmp, semanasOrdenadas, equalizacaoComFator, despesasProjetosPorSemana = {}, projetosInternos = [], saldosAcumulados = {}) {
  const aportesPorSemana = {};
  let somaAportesAnteriores = 0;

  for (let i = 0; i < semanasOrdenadas.length; i++) {
    const semana = semanasOrdenadas[i];
    const lanc = lancamentos.find(l => l.semana_id === semana.id) || {};
    const despProjetos = despesasProjetosPorSemana[semana.id] || 0;
    
    // despesas = consolidada + prevista (sem despesa_afac)
    let despesasSemana;
    if (empreendimento.tipo_fluxo === 'multi_projetos') {
      despesasSemana = despProjetos;
    } else {
      despesasSemana = (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0);
    }

    let aporteSemana = 0;
    if (i === 0) {
      // Semana 1: compara despesas com saldo_atual (sem considerar receitas)
      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (empreendimento.tipo_fluxo === 'multi_projetos' && projetosInternos.length > 0) {
        saldoAtual = projetosInternos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }
      if (despesasSemana > saldoAtual) {
        aporteSemana = despesasSemana - saldoAtual + (empreendimento.margem_seguranca_semana1 || 0);
      }
    } else {
      // Semanas 2+: usa saldo_acumulado da tabela Fluxo Semanal (pré-calculado)
      const semanaAnterior = semanasOrdenadas[i - 1];
      const saldoAcumAnterior = saldosAcumulados[semanaAnterior.id] || 0;
      if (despesasSemana > saldoAcumAnterior) {
        aporteSemana = despesasSemana - saldoAcumAnterior + (empreendimento.margem_seguranca_demais || 0) - somaAportesAnteriores;
      }
    }

    aporteSemana = Math.max(0, aporteSemana);
    somaAportesAnteriores += aporteSemana;

    // rateio por sócio
    const porSocio = {};
    equalizacaoComFator.forEach(e => {
      porSocio[e.socio_id] = aporteSemana * e.fatorRateio;
    });

    aportesPorSemana[semana.id] = {
      total: aporteSemana,
      porSocio
    };
  }
  return aportesPorSemana;
}