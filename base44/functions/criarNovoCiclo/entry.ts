import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { addDays, format, parseISO } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { nome, data_inicio } = await req.json();
    if (!nome || !data_inicio) {
      return Response.json({ error: 'Nome e data de início são obrigatórios' }, { status: 400 });
    }

    // Find current active cycle (optional — first cycle has no previous)
    const ciclosAtivos = await base44.entities.Ciclo.filter({ status: 'ativo' });
    const cicloAntigo = ciclosAtivos.length > 0 ? ciclosAtivos[0] : null;

    // 1. Create new cycle as active
    const novoCiclo = await base44.entities.Ciclo.create({ nome, status: 'ativo' });

    // 2. Create 6 semanas
    const start = parseISO(data_inicio);
    const semanaIds = [];
    for (let i = 0; i < 6; i++) {
      const inicio = addDays(start, i * 7);
      const fim = addDays(inicio, 6);
      const rotulo = `${format(inicio, 'dd/MM')} - ${format(fim, 'dd/MM')}`;
      const semana = await base44.entities.Semana.create({
        ciclo_id: novoCiclo.id,
        numero: i + 1,
        data_inicio: format(inicio, 'yyyy-MM-dd'),
        data_fim: format(fim, 'yyyy-MM-dd'),
        rotulo
      });
      semanaIds.push(semana.id);
    }

    // 3. Get all active empreendimentos
    const empreendimentos = await base44.entities.Empreendimento.filter({ ativo: true });

    // 4. Create zero LancamentoSemanal for each empreendimento × semana
    for (const emp of empreendimentos) {
      const lancamentosToCreate = semanaIds.map(sid => ({
        empreendimento_id: emp.id,
        semana_id: sid,
        despesa_consolidada: 0,
        despesa_prevista: 0,
        despesa_r21: 0,
        despesa_afac: 0,
        receita_consolidada: 0,
        receita_prevista: 0,
      }));
      if (lancamentosToCreate.length > 0) {
        await base44.entities.LancamentoSemanal.bulkCreate(lancamentosToCreate);
      }
    }

    // 5. Copy SaldoEmpreendimento from old cycle (or create zeroed if none)
    const empsComSaldo = new Set();
    if (cicloAntigo) {
      const saldosAntigos = await base44.entities.SaldoEmpreendimento.filter({ ciclo_id: cicloAntigo.id });
      for (const saldo of saldosAntigos) {
        empsComSaldo.add(saldo.empreendimento_id);
        await base44.entities.SaldoEmpreendimento.create({
          empreendimento_id: saldo.empreendimento_id,
          ciclo_id: novoCiclo.id,
          saldo_atual: saldo.saldo_atual || 0,
          saldo_aplicado: saldo.saldo_aplicado || 0,
          saldo_atual_r21: saldo.saldo_atual_r21 || 0,
          saldo_decoracao: saldo.saldo_decoracao || 0,
          inadimplencia: saldo.inadimplencia || 0,
          observacoes: saldo.observacoes || '',
        });
      }
    }

    // Create zeroed SaldoEmpreendimento for empreendimentos without one
    for (const emp of empreendimentos) {
      if (!empsComSaldo.has(emp.id)) {
        await base44.entities.SaldoEmpreendimento.create({
          empreendimento_id: emp.id,
          ciclo_id: novoCiclo.id,
          saldo_atual: 0,
          saldo_aplicado: 0,
          saldo_atual_r21: 0,
          saldo_decoracao: 0,
          inadimplencia: 0,
          observacoes: '',
        });
      }
    }

    // 6. Create zero DespesaProjetoSemanal for multi_projetos empreendimentos
    const projetos = await base44.entities.ProjetoInterno.filter({});
    const empMultiProjIds = empreendimentos
      .filter(e => e.tipo_fluxo === 'multi_projetos')
      .map(e => e.id);
    const projetosRelevantes = projetos.filter(p => empMultiProjIds.includes(p.empreendimento_pai_id));

    if (projetosRelevantes.length > 0) {
      const despesasToCreate = [];
      for (const proj of projetosRelevantes) {
        for (const sid of semanaIds) {
          despesasToCreate.push({
            projeto_id: proj.id,
            semana_id: sid,
            valor_despesa: 0,
          });
        }
      }
      if (despesasToCreate.length > 0) {
        await base44.entities.DespesaProjetoSemanal.bulkCreate(despesasToCreate);
      }
    }

    // 7. Mark old cycle as encerrado
    if (cicloAntigo) {
      await base44.entities.Ciclo.update(cicloAntigo.id, { status: 'encerrado' });
    }

    return Response.json({
      success: true,
      ciclo_id: novoCiclo.id,
      nome: novoCiclo.nome
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});