import React, { useMemo } from 'react';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcEqualizacao, calcFatorRateio, calcAportesPorSemana, calcSaldosAcumulados, formatBRL, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
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

    const contasAPagar = calcContasAPagar(empLancs, semanasOrdenadas, emp, despPorSemana, 4);

    let saldoAtual = saldoEmp?.saldo_atual || 0;
    if (emp.tipo_fluxo === 'multi_projetos' && projs.length > 0) {
      saldoAtual = projs.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
    }

    const aporteTotal = contasAPagar > saldoAtual ? contasAPagar - saldoAtual + (emp.margem_aporte_total || 0) : 0;
    const eq = calcEqualizacao(empParts, aporteTotal, emp, socios);
    const eqF = calcFatorRateio(eq);
    const acumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, semanasOrdenadas, despPorSemana, projs);
    return calcAportesPorSemana(empLancs, emp, saldoEmp, semanasOrdenadas, eqF, despPorSemana, projs, acumulados);
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

  // Build rows (4 linhas conforme especificação)
  const rows = [
    {
      label: 'Lisboa (GTR na Solenne)',
      getData: (semanaId) => aportesSolenne[semanaId]?.porSocio[socioGTR?.id] || 0,
    },
    {
      label: 'R21 (Despesa RIC)',
      getData: (semanaId) => {
        const ricEmp = empreendimentos.find(e => e.nome && e.nome.toLowerCase().includes('ric') && e.tipo_fluxo !== 'multi_projetos');
        const lanc = lancamentos.find(l => l.empreendimento_id === ricEmp?.id && l.semana_id === semanaId);
        return lanc?.despesa_r21 || 0;
      },
    },
    {
      label: 'Ponta do Lobo (Ricardo)',
      getData: (semanaId) => aportesPontaDoLobo[semanaId]?.porSocio[socioRicardo?.id] || 0,
    },
    {
      label: 'Green Concept (RIC)',
      getData: (semanaId) => aportesGrupoGC[semanaId]?.porSocio[socioRIC?.id] || 0,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-heading font-bold">Aportes Ricardo</h1>
        <p className="text-[14px] text-muted-foreground mt-1">Consolidação dos aportes vinculados ao Ricardo</p>
      </div>

      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[20px] font-heading font-medium">Aportes por Semana</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-[15px] min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Origem</th>
                {semanasOrdenadas.map(s => (
                  <th key={s.id} className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">
                    {s.rotulo || `Sem ${s.numero}`}
                  </th>
                ))}
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                let total = 0;
                return (
                  <tr key={row.label} className={`border-b border-[#E5E5E5] ${ri % 2 === 0 ? 'bg-[#FAFAFA]' : ''}`} style={{ height: '44px' }}>
                    <td className="py-3 px-3 font-medium">{row.label}</td>
                    {semanasOrdenadas.map(s => {
                      const val = row.getData(s.id);
                      total += val;
                      return (
                        <td key={s.id} className={`text-right py-3 px-3 tabular-nums ${val > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {formatBRL(val)}
                        </td>
                      );
                    })}
                    <td className="text-right py-3 px-3 tabular-nums font-semibold">{formatBRL(total)}</td>
                  </tr>
                );
              })}
              {/* TOTAL row */}
              <tr className="bg-[#F0F0F0] border-t-2 border-foreground">
                <td className="py-3 px-3 font-semibold">TOTAL</td>
                {semanasOrdenadas.map(s => {
                  const total = rows.reduce((sum, r) => sum + r.getData(s.id), 0);
                  return (
                    <td key={s.id} className="text-right py-3 px-3 tabular-nums font-semibold">{formatBRL(total)}</td>
                  );
                })}
                <td className="text-right py-3 px-3 tabular-nums font-semibold">
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