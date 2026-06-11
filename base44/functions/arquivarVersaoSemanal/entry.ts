import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar ciclo ativo
    const ciclosAtivos = await base44.entities.Ciclo.filter({ status: 'ativo' });
    if (ciclosAtivos.length === 0) {
      return Response.json({ error: 'Nenhum ciclo ativo encontrado' }, { status: 400 });
    }
    const cicloAtivo = ciclosAtivos[0];

    // Buscar todas as semanas do ciclo
    const semanas = await base44.entities.Semana.filter({ ciclo_id: cicloAtivo.id });

    // Buscar todos os empreendimentos ativos
    const empreendimentos = await base44.entities.Empreendimento.filter({ ativo: true });

    // Buscar todos os lançamentos do ciclo
    const semanaIds = semanas.map(s => s.id);
    const todosLancamentos = [];
    for (const emp of empreendimentos) {
      const lancs = await base44.entities.LancamentoSemanal.filter({
        empreendimento_id: emp.id
      });
      todosLancamentos.push(...lancs.filter(l => semanaIds.includes(l.semana_id)));
    }

    // Buscar saldos
    const saldos = await base44.entities.SaldoEmpreendimento.filter({ ciclo_id: cicloAtivo.id });

    // Buscar projetos internos
    const projetos = await base44.entities.ProjetoInterno.filter({});

    // Buscar despesas de projetos
    const todasDespesas = [];
    for (const proj of projetos) {
      const desps = await base44.entities.DespesaProjetoSemanal.filter({ projeto_id: proj.id });
      todasDespesas.push(...desps.filter(d => semanaIds.includes(d.semana_id)));
    }

    // Buscar participações
    const participacoes = await base44.entities.Participacao.filter({});

    // Buscar sócios
    const socios = await base44.entities.Socio.filter({});

    // Montar resumo por empreendimento
    const resumo = {};
    for (const emp of empreendimentos) {
      const empLancs = todosLancamentos.filter(l => l.empreendimento_id === emp.id);
      const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);

      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (emp.tipo_fluxo === 'multi_projetos') {
        const empProjs = projetos.filter(p => p.empreendimento_pai_id === emp.id);
        saldoAtual = empProjs.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }

      const contasAPagar = empLancs
        .filter(l => semanas.find(s => s.id === l.semana_id && s.numero <= 4))
        .reduce((sum, l) => sum + (l.despesa_consolidada || 0) + (l.despesa_prevista || 0) + (l.despesa_afac || 0) + (l.despesa_r21 || 0), 0);

      resumo[emp.id] = {
        nome: emp.nome,
        saldoAtual,
        contasAPagar
      };
    }

    const hoje = new Date().toISOString().split('T')[0];

    const snapshot = {
      ciclo_id: cicloAtivo.id,
      semanas,
      empreendimentos,
      lancamentos: todosLancamentos,
      saldos,
      projetos,
      despesasProjetos: todasDespesas,
      participacoes,
      socios
    };

    await base44.entities.VersaoSemanal.create({
      data_referencia: hoje,
      ciclo_id: cicloAtivo.id,
      snapshot,
      resumo
    });

    return Response.json({ success: true, data_referencia: hoje });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});