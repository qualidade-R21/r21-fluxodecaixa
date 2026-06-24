import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const sr = base44.asServiceRole;

    const entidades = [
      'LancamentoSemanal',
      'SaldoEmpreendimento',
      'DespesaProjetoSemanal',
      'VersaoSemanal',
      'RegistroImportacao',
    ];

    const resultados = {};

    for (const nome of entidades) {
      const registros = await sr.entities[nome].list('', 500);
      const count = registros.length;
      let remaining = count;
      while (remaining > 0) {
        const batchSize = Math.min(remaining, 500);
        const ids = registros.slice(count - remaining, count - remaining + batchSize).map(r => r.id);
        await sr.entities[nome].deleteMany({ id: { $in: ids } });
        remaining -= batchSize;
      }
      resultados[nome] = count;
    }

    return Response.json({ success: true, deletados: resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});