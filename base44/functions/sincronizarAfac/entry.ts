import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { updates, creates } = await req.json();

    if (updates && updates.length) {
      await Promise.all(updates.map(async (u) => {
        try {
          await base44.asServiceRole.entities.LancamentoSemanal.update(u.id, u.data);
        } catch (e) {
          // Record may have been deleted — fall back to create
          if (u.data && u.data.semana_id && u.data.empreendimento_id) {
            await base44.asServiceRole.entities.LancamentoSemanal.create(u.data);
          }
        }
      }));
    }

    if (creates && creates.length) {
      await base44.asServiceRole.entities.LancamentoSemanal.bulkCreate(creates);
    }

    return Response.json({ success: true, updated: updates?.length || 0, created: creates?.length || 0 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});