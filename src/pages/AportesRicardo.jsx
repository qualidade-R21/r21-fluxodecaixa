import React, { useMemo } from 'react';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcEqualizacao, calcFatorRateio, calcAportesPorSemana, formatBRL, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AportesRicardo() {
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanas } = useSemanas(cicloAtivo?.id);
  const semanaIds = useMemo(() => semanas.map(s => s.id), [semanas]);
  const { data: lancamentos } = useLancamentos(cicloAtivo?.id, semanaIds);
  const { data: saldos } = useSaldos(cicloAtivo?.id);
  const { data: socios } = useSocios();
  const { data: participacoes } = useParticipacoes();

  const gcEmp = empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos');
  const { data: projetos } = useProjetosInternos(gcEmp?.id);
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);

  const semanasOrdenadas = useMemo(() =>
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  // Helper to compute aportes for an empreendimento
  const getAportes = (empNome) => {
    const emp = empreendimentos.find(e => e.nome.includes(empNome));
    if (!emp) return {};
    const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
    const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
    
    let despPorSemana = {};
    let projs = [];
    if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
      projs = projetos;
      const projetoIds = projetos.map(p => p.id);
      semanasOrdenadas.forEach(s => {
        despPorSemana[s.id] = despesasProjetos
          .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
          .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
      });
    }

    let contasAPagar = 0;
    for (let i = 0; i < Math.min(4, semanasOrdenadas.length); i++) {
      const s = semanasOrdenadas[i];
      const lanc = empLancs.find(l => l.semana_id === s.id) || {};
      const dp = despPorSemana[s.id] || 0;
      contasAPagar += (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0) + (lanc.despesa_afac || 0) + dp;
    }

    let saldoAtual = saldoEmp?.saldo_atual || 0;
    if (emp.tipo_fluxo === 'multi_projetos' && projs.length > 0) {
      saldoAtual = projs.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
    }

    const aporteTotal = contasAPagar > saldoAtual ? contasAPagar - saldoAtual + (emp.margem_aporte_total || 0) : 0;
    const eq = calcEqualizacao(empParts, aporteTotal);
    const eqF = calcFatorRateio(eq);
    return calcAportesPorSemana(empLancs, emp, saldoEmp, semanasOrdenadas, eqF, despPorSemana, projs);
  };

  // Find relevant socio IDs
  const socioGTR = socios.find(s => s.nome === 'GTR');
  const socioRicardo = socios.find(s => s.nome === 'Ricardo');
  const socioRIC = socios.find(s => s.nome === 'RIC');
  
  const gtrEmp = empreendimentos.find(e => e.nome.includes('GTR'));

  // Compute aportes
  const aportesPontaDoLobo = useMemo(() => getAportes('Ponta do Lobo'), [empreendimentos, lancamentos, saldos, participacoes, semanasOrdenadas]);
  const aportesSolenne = useMemo(() => getAportes('Solenne'), [empreendimentos, lancamentos, saldos, participacoes, semanasOrdenadas]);
  const aportesGrupoGC = useMemo(() => getAportes('Green Concept'), [empreendimentos, lancamentos, saldos, participacoes, semanasOrdenadas, projetos, despesasProjetos]);

  // Build rows
  const rows = [
    {
      label: 'Ponta do Lobo (Total)',
      getData: (semanaId) => aportesPontaDoLobo[semanaId]?.total || 0,
    },
    {
      label: 'Lisboa (GTR na Solenne)',
      getData: (semanaId) => aportesSolenne[semanaId]?.porSocio[socioGTR?.id] || 0,
    },
    {
      label: 'R21 (Despesa GTR)',
      getData: (semanaId) => {
        const lanc = lancamentos.find(l => l.empreendimento_id === gtrEmp?.id && l.semana_id === semanaId);
        return lanc?.despesa_r21 || 0;
      },
    },
    {
      label: 'Ricardo (Ponta do Lobo)',
      getData: (semanaId) => aportesPontaDoLobo[semanaId]?.porSocio[socioRicardo?.id] || 0,
    },
    {
      label: 'RIC (Grupo GC)',
      getData: (semanaId) => aportesGrupoGC[semanaId]?.porSocio[socioRIC?.id] || 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Aportes Ricardo</h1>
        <p className="text-sm text-muted-foreground mt-1">Consolidação dos aportes vinculados ao Ricardo</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Aportes por Semana</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-heading text-muted-foreground">Origem</th>
                {semanasOrdenadas.map(s => (
                  <th key={s.id} className="text-right py-2 px-2 font-heading text-muted-foreground">
                    {s.rotulo || `Sem ${s.numero}`}
                  </th>
                ))}
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                let total = 0;
                return (
                  <tr key={row.label} className="border-b border-border/50">
                    <td className="py-2 px-2 font-medium">{row.label}</td>
                    {semanasOrdenadas.map(s => {
                      const val = row.getData(s.id);
                      total += val;
                      return (
                        <td key={s.id} className={`text-right py-2 px-2 tabular-nums ${val > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {formatBRL(val)}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 px-2 tabular-nums font-bold">{formatBRL(total)}</td>
                  </tr>
                );
              })}
              {/* TOTAL row */}
              <tr className="border-t-2 border-foreground">
                <td className="py-2 px-2 font-bold">TOTAL</td>
                {semanasOrdenadas.map(s => {
                  const total = rows.reduce((sum, r) => sum + r.getData(s.id), 0);
                  return (
                    <td key={s.id} className="text-right py-2 px-2 tabular-nums font-bold">{formatBRL(total)}</td>
                  );
                })}
                <td className="text-right py-2 px-2 tabular-nums font-bold">
                  {formatBRL(semanasOrdenadas.reduce((sum, s) => sum + rows.reduce((rs, r) => rs + r.getData(s.id), 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}