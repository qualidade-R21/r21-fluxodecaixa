import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatBRL, calcEqualizacao, calcFatorRateio, calcAportesPorSemana } from '@/lib/calculos';

export default function AportesSection({ emp, semanas, lancamentos, saldoEmp, participacoes, socios, despesasPorSemana, projetosInternos }) {
  if (emp.tipo_fluxo !== 'com_aportes' && emp.tipo_fluxo !== 'multi_projetos') return null;

  const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
  if (empParts.length === 0) return null;

  // Contas a pagar
  let contasAPagar = 0;
  for (let i = 0; i < Math.min(4, semanas.length); i++) {
    const s = semanas[i];
    const lanc = lancamentos.find(l => l.semana_id === s.id && l.empreendimento_id === emp.id) || {};
    const despP = despesasPorSemana?.[s.id] || 0;
    contasAPagar += (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0) + (lanc.despesa_afac || 0) + despP;
  }

  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp.tipo_fluxo === 'multi_projetos' && projetosInternos?.length > 0) {
    saldoAtual = projetosInternos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }

  const aporteTotal = contasAPagar > saldoAtual ? contasAPagar - saldoAtual + (emp.margem_aporte_total || 0) : 0;
  const equalizacao = calcEqualizacao(empParts, aporteTotal);
  const eqComFator = calcFatorRateio(equalizacao);
  const aportesSemana = calcAportesPorSemana(lancamentos, emp, saldoEmp, semanas, eqComFator, despesasPorSemana, projetosInternos);

  const getSocioNome = (id) => socios.find(s => s.id === id)?.nome || '—';

  return (
    <div className="space-y-4">
      {/* Resumo Valores Aportados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Resumo Valores Aportados (Equalização)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-heading text-muted-foreground">Sócio</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">% Soc.</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Aportado</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Devolvido</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Saldo Dev.</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">% Atual</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Total p/ Eq.</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Aporte Nec.</th>
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Fator</th>
              </tr>
            </thead>
            <tbody>
              {eqComFator.map(e => (
                <tr key={e.socio_id} className="border-b border-border/50">
                  <td className="py-2 px-2 font-medium">{getSocioNome(e.socio_id)}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{e.percentual_sociedade?.toFixed(2)}%</td>
                  <td className="text-right py-2 px-2 tabular-nums">{formatBRL(e.valor_aportado)}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{formatBRL(e.valor_devolvido)}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{formatBRL(e.saldoADevolver)}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{(e.percentualAtual * 100).toFixed(2)}%</td>
                  <td className="text-right py-2 px-2 tabular-nums">{formatBRL(e.totalParaEqualizar)}</td>
                  <td className={`text-right py-2 px-2 tabular-nums font-bold ${e.aporteNecessario < 0 ? 'text-primary' : ''}`}>{formatBRL(e.aporteNecessario)}</td>
                  <td className="text-right py-2 px-2 tabular-nums">{(e.fatorRateio * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Aportes por Semana */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Aportes por Semana</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-heading text-muted-foreground">Sócio</th>
                {semanas.map(s => (
                  <th key={s.id} className="text-right py-2 px-2 font-heading text-muted-foreground">
                    {s.rotulo || `Sem ${s.numero}`}
                  </th>
                ))}
                <th className="text-right py-2 px-2 font-heading text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {eqComFator.map(e => {
                let totalSocio = 0;
                return (
                  <tr key={e.socio_id} className="border-b border-border/50">
                    <td className="py-2 px-2 font-medium">{getSocioNome(e.socio_id)}</td>
                    {semanas.map(s => {
                      const val = aportesSemana[s.id]?.porSocio[e.socio_id] || 0;
                      totalSocio += val;
                      return (
                        <td key={s.id} className={`text-right py-2 px-2 tabular-nums ${val > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {formatBRL(val)}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 px-2 tabular-nums font-bold">{formatBRL(totalSocio)}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="border-t-2 border-foreground">
                <td className="py-2 px-2 font-bold">TOTAL</td>
                {semanas.map(s => (
                  <td key={s.id} className="text-right py-2 px-2 tabular-nums font-bold">
                    {formatBRL(aportesSemana[s.id]?.total || 0)}
                  </td>
                ))}
                <td className="text-right py-2 px-2 tabular-nums font-bold">
                  {formatBRL(Object.values(aportesSemana).reduce((sum, a) => sum + a.total, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}