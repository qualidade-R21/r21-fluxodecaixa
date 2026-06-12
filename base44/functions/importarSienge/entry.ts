import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { empreendimento_id, ciclo_id, previews, semanaIds } = await req.json();

    // Buscar lancamentos existentes UMA vez (fora do loop)
    const existing = await base44.asServiceRole.entities.LancamentoSemanal.filter({
      empreendimento_id,
      semana_id: { $in: semanaIds }
    });
    const existingMap = {};
    existing.forEach(l => { existingMap[l.semana_id] = l; });

    for (const preview of previews) {
      const field = preview.tipo === 'despesas' ? 'despesa_consolidada' : 'receita_consolidada';

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

      await base44.asServiceRole.entities.RegistroImportacao.create({
        empreendimento_id,
        ciclo_id,
        nome_arquivo: preview.fileNome,
        tipo: preview.tipo,
        total_extraido: preview.totalExtraido,
      });
    }

    return Response.json({ success: true, count: previews.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});