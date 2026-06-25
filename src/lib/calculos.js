// Utilitários de cálculo do Fluxo de Caixa Semanal R21

export function formatBRL(value) {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function parseBRL(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

// ── Helpers para classificar entidade ──

function getTipoDespesa(emp) {
  if (!emp) return 'standard';
  if (emp.tipo_fluxo === 'multi_projetos') return 'gc';
  const nome = (emp.nome || '').toLowerCase();
  if (nome.includes('gtr')) return 'gtr';
  if (nome.includes('ric') && emp.tipo_fluxo !== 'multi_projetos') return 'ric';
  return 'standard';
}

// Retorna o total de despesas da semana conforme o tipo de entidade
function getDespesas(lanc, tipo, despProjetos, empreendimento) {
  switch (tipo) {
    case 'gc':
      return despProjetos;
    case 'gtr':
      if (empreendimento?.despesa_dividida_r21) {
        return (lanc.despesa_consolidada || 0) + (lanc.despesa_r21 || 0) + (lanc.despesa_afac || 0);
      }
      return (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0);
    case 'ric':
      // despesa_RIC = consolidada + prevista + r21 + afac
      return (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0) + (lanc.despesa_r21 || 0) + (lanc.despesa_afac || 0);
    default:
      // Cape Town, Holmes, Solenne, Pátio Estaleiro, Ponta do Lobo
      return (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0);
  }
}

// ── A) Saldo da Semana ──

export function calcSaldoSemana(lancamento, empreendimento, despesasProjetos = 0) {
  const tipo = getTipoDespesa(empreendimento);
  const despesas = getDespesas(lancamento, tipo, despesasProjetos, empreendimento);

  if (tipo === 'gc') {
    return -despesas; // GC não tem receitas
  }

  const receitas = (lancamento.receita_consolidada || 0) + (lancamento.receita_prevista || 0);
  return receitas - despesas;
}

// ── B) Saldo Acumulado ──

export function calcSaldosAcumulados(lancamentos, empreendimento, saldoEmp, semanasOrdenadas, despesasProjetosPorSemana = {}, projetosInternos = []) {
  const acumulados = {};
  let anterior = 0;

  for (let i = 0; i < semanasOrdenadas.length; i++) {
    const semana = semanasOrdenadas[i];
    const lanc = lancamentos.find(l => l.semana_id === semana.id) || {};
    const despProjetos = despesasProjetosPorSemana[semana.id] || 0;
    const saldoSemana = calcSaldoSemana(lanc, empreendimento, despProjetos);

    if (i === 0) {
      const saldoAtual = saldoEmp?.saldo_atual || 0;
      const saldoAplicado = empreendimento.tem_saldo_aplicado ? (saldoEmp?.saldo_aplicado || 0) : 0;
      anterior = saldoAtual + saldoAplicado + saldoSemana;
    } else {
      anterior = anterior + saldoSemana;
    }
    acumulados[semana.id] = anterior;
  }
  return acumulados;
}

// ── C) Contas a Pagar (Mês Atual) - semanas 1 a N, colunas por tipo de entidade ──

export function calcContasAPagar(lancamentos, semanasOrdenadas, emp, despesasProjetosPorSemana = {}, numSemanas = 4) {
  const tipo = getTipoDespesa(emp);
  let total = 0;
  const limite = Math.min(numSemanas, semanasOrdenadas.length);
  for (let i = 0; i < limite; i++) {
    const semana = semanasOrdenadas[i];
    const lanc = lancamentos.find(l => l.semana_id === semana.id) || {};
    const despProjetos = despesasProjetosPorSemana[semana.id] || 0;
    total += getDespesas(lanc, tipo, despProjetos, emp);
  }
  return total;
}

// ── D) Aporte Total Necessário ──

export function calcAporteTotalNecessario(contasAPagar, saldoAtual, margemAporteTotal) {
  if (contasAPagar > saldoAtual) {
    return contasAPagar - saldoAtual + margemAporteTotal;
  }
  return 0;
}

// ── E) Equalização societária ──
// BASE: Solenne = Σ aportado; Ponta do Lobo e GC = Σ saldo_a_devolver
// Exceção (sócios com devolução): Ricardo no PDL e RIC no GC usam para_equalizar − saldo_a_devolver

export function calcEqualizacao(participacoes, aporteTotalNecessario, emp, socios = []) {
  const nomeEmp = (emp?.nome || '').toLowerCase();
  const isSolenne = nomeEmp.includes('solenne');
  const isPDL = nomeEmp.includes('ponta do lobo');
  const isGC = emp?.tipo_fluxo === 'multi_projetos';

  const totalAportado = participacoes.reduce((sum, p) => sum + (p.valor_aportado || 0), 0);
  const totalSaldoADevolver = participacoes.reduce((sum, p) => {
    return sum + ((p.valor_aportado || 0) - (p.valor_devolvido || 0));
  }, 0);

  // BASE: Solenne usa Σ aportado; PDL e GC usam Σ saldo_a_devolver; outros (fallback) usam Σ saldo_a_devolver
  const BASE = isSolenne ? totalAportado : totalSaldoADevolver;

  const getSocioNome = (socioId) => {
    const s = socios.find(x => x.id === socioId);
    return (s?.nome || '').toLowerCase();
  };

  return participacoes.map(p => {
    const saldoADevolver = (p.valor_aportado || 0) - (p.valor_devolvido || 0);
    const percentualAtual = totalSaldoADevolver > 0 ? saldoADevolver / totalSaldoADevolver : 0;
    const totalParaEqualizar = (BASE + aporteTotalNecessario) * ((p.percentual_sociedade || 0) / 100);

    // Exceção: Ricardo no PDL e RIC no GC usam saldo_a_devolver como subtraendo
    const socioNome = getSocioNome(p.socio_id);
    const usaSaldoADevolver =
      (isPDL && socioNome === 'ricardo') ||
      (isGC && socioNome === 'ric');

    const aporteNecessario = usaSaldoADevolver
      ? totalParaEqualizar - saldoADevolver
      : totalParaEqualizar - (p.valor_aportado || 0);

    return {
      ...p,
      saldoADevolver,
      percentualAtual,
      totalParaEqualizar,
      aporteNecessario
    };
  });
}

// ── F) Fator de rateio: fator(s) = aporte_necessario(s) ÷ Σ aporte_necessario ──

export function calcFatorRateio(equalizacao) {
  // Clampa negativos a 0 para rateio (não faz sentido fator negativo)
  const aportesPositivos = equalizacao.map(e => Math.max(0, e.aporteNecessario || 0));
  const somaAportes = aportesPositivos.reduce((sum, v) => sum + v, 0);
  return equalizacao.map((e, i) => ({
    ...e,
    fatorRateio: somaAportes > 0 ? aportesPositivos[i] / somaAportes : 0
  }));
}

// ── G) Aportes por Semana ──
// desp(w): Solenne = consolidada+prevista | PDL = consolidada | GC = soma projetos

function getDespesasAporte(lanc, emp, despProjetos) {
  const nome = (emp?.nome || '').toLowerCase();
  if (emp?.tipo_fluxo === 'multi_projetos') {
    return despProjetos;
  }
  if (nome.includes('ponta do lobo')) {
    return (lanc.despesa_consolidada || 0); // PDL: só consolidada
  }
  return (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0); // Solenne e outros: as duas
}

export function calcAportesPorSemana(lancamentos, empreendimento, saldoEmp, semanasOrdenadas, equalizacaoComFator, despesasProjetosPorSemana = {}, projetosInternos = [], saldosAcumulados = {}) {
  const aportesPorSemana = {};
  let somaAportesAnteriores = 0;

  for (let i = 0; i < semanasOrdenadas.length; i++) {
    const semana = semanasOrdenadas[i];
    const lanc = lancamentos.find(l => l.semana_id === semana.id) || {};
    const despProjetos = despesasProjetosPorSemana[semana.id] || 0;

    const despesasSemana = getDespesasAporte(lanc, empreendimento, despProjetos);

    let aporteSemana = 0;
    if (i === 0) {
      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (empreendimento.tipo_fluxo === 'multi_projetos' && projetosInternos.length > 0) {
        saldoAtual = projetosInternos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }
      if (despesasSemana > saldoAtual) {
        aporteSemana = despesasSemana - saldoAtual + (empreendimento.margem_seguranca_semana1 || 0);
      }
    } else {
      const semanaAnterior = semanasOrdenadas[i - 1];
      const saldoAcumAnterior = saldosAcumulados[semanaAnterior.id] || 0;
      if (despesasSemana > saldoAcumAnterior) {
        aporteSemana = despesasSemana - saldoAcumAnterior + (empreendimento.margem_seguranca_demais || 0) - somaAportesAnteriores;
      }
    }

    aporteSemana = Math.max(0, aporteSemana);
    somaAportesAnteriores += aporteSemana;

    // rateio por sócio usando fatorRateio
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