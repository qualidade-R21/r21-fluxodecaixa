import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      const registros = await sr.entities[nome].list('', 100);
      await sleep(1000);

      for (const r of registros) {
        await sr.entities[nome].delete(r.id);
        await sleep(200);
      }

      resultados[nome] = registros.length;
    }

    return Response.json({ success: true, deletados: resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});