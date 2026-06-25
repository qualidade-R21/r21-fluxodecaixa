import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { empreendimento_id, ciclo_id, previews, semanaIds, fileUrls } = await req.json();

    // Verificar se é multi_projetos
    const emp = await base44.asServiceRole.entities.Empreendimento.get(empreendimento_id);
    const isMulti = emp?.tipo_fluxo === 'multi_projetos';
    let projetos = [];
    if (isMulti) {
      projetos = await base44.asServiceRole.entities.ProjetoInterno.filter({
        empreendimento_pai_id: empreendimento_id,
      });
    }

    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];
      const field = preview.campoDestino || (preview.tipo === 'despesas' ? 'despesa_consolidada' : 'receita_consolidada');

      // Determinar se mapeia para um projeto filho (multi_projetos + nomeEmpresa bate)
      let projetoMatch = null;
      if (isMulti && preview.nomeEmpresa && projetos.length > 0) {
        projetoMatch = projetos.find(p =>
          p.nome.toLowerCase() === preview.nomeEmpresa.toLowerCase() ||
          preview.nomeEmpresa.toLowerCase().includes(p.nome.toLowerCase())
        );
      }

      if (projetoMatch) {
        // Multi Projetos: salvar em DespesaProjetoSemanal
        const existingDespesas = await base44.asServiceRole.entities.DespesaProjetoSemanal.filter({
          projeto_id: projetoMatch.id,
          semana_id: { $in: semanaIds }
        });
        const existingMap = {};
        existingDespesas.forEach(d => { existingMap[d.semana_id] = d; });

        const updates = [];
        const creates = [];

        for (const sid of semanaIds) {
          const val = preview.porSemana[sid] || 0;
          if (val === 0) continue;

          const rec = existingMap[sid];
          if (rec) {
            updates.push(
              base44.asServiceRole.entities.DespesaProjetoSemanal.update(rec.id, { valor_despesa: val })
            );
          } else {
            creates.push({ projeto_id: projetoMatch.id, semana_id: sid, valor_despesa: val });
          }
        }

        if (updates.length) await Promise.all(updates);
        if (creates.length) await base44.asServiceRole.entities.DespesaProjetoSemanal.bulkCreate(creates);
      } else {
        // Projeto único (ou multi sem match): salvar em LancamentoSemanal
        const existing = await base44.asServiceRole.entities.LancamentoSemanal.filter({
          empreendimento_id,
          semana_id: { $in: semanaIds }
        });
        const existingMap = {};
        existing.forEach(l => { existingMap[l.semana_id] = l; });

        const updates = [];
        const creates = [];

        for (const sid of semanaIds) {
          const val = preview.porSemana[sid] || 0;
          if (val === 0) continue;

          const rec = existingMap[sid];
          if (rec) {
            updates.push(
              base44.asServiceRole.entities.LancamentoSemanal.update(rec.id, { [field]: val })
            );
          } else {
            creates.push({ empreendimento_id, semana_id: sid, [field]: val });
          }
        }

        if (updates.length) await Promise.all(updates);
        if (creates.length) await base44.asServiceRole.entities.LancamentoSemanal.bulkCreate(creates);
      }

      // Registrar importação
      const registroData = {
        empreendimento_id,
        ciclo_id,
        nome_arquivo: preview.fileNome,
        tipo: preview.tipo,
        total_extraido: preview.totalExtraido,
      };
      if (fileUrls && fileUrls[i]) {
        registroData.file_url = fileUrls[i];
      }
      await base44.asServiceRole.entities.RegistroImportacao.create(registroData);
    }

    // Atualizar datas e rótulos das semanas com base no relatório PDF
    const previewComWeekDates = previews.find(p => p.newWeekDates);
    if (previewComWeekDates?.newWeekDates) {
      for (const wd of previewComWeekDates.newWeekDates) {
        await base44.asServiceRole.entities.Semana.update(wd.id, {
          data_inicio: wd.data_inicio,
          data_fim: wd.data_fim,
          rotulo: wd.rotulo
        });
      }
    }

    return Response.json({ success: true, count: previews.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});