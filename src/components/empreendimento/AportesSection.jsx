import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatBRL, calcEqualizacao, calcFatorRateio, calcAportesPorSemana } from '@/lib/calculos';

export default function AportesSection({ emp, semanas, lancamentos, saldoEmp, participacoes, socios, despesasPorSemana, projetosInternos, acumulados }) {
  if (emp.tipo_fluxo !== 'com_aportes' && emp.tipo_fluxo !== 'multi_projetos') return null;

  const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
  if (empParts.length === 0) return null;

  let contasAPagar = 0;
  for (let i = 0; i < Math.min(4, semanas.length); i++) {
    const s = semanas[i];
    const lanc = lancamentos.find(l => l.semana_id === s.id && l.empreendimento_id === emp.id) || {};
    const despP = despesasPorSemana?.[s.id] || 0;
    contasAPagar += (lanc.despesa_consolidada || 0) + (lanc.despesa_prevista || 0) + (lanc.despesa_r21 || 0) + (lanc.despesa_afac || 0) + despP;
  }

  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp.tipo_fluxo === 'multi_projetos' && projetosInternos?.length > 0) {
    saldoAtual = projetosInternos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }

  const aporteTotal = contasAPagar > saldoAtual ? contasAPagar - saldoAtual + (emp.margem_aporte_total || 0) : 0;
  const equalizacao = calcEqualizacao(empParts, aporteTotal);
  const eqComFator = calcFatorRateio(equalizacao);
  const aportesSemana = calcAportesPorSemana(lancamentos, emp, saldoEmp, semanas, eqComFator, despesasPorSemana, projetosInternos, acumulados);

  const getSocioNome = (id) => socios.find(s => s.id === id)?.nome || '—';

  return (
    <div className="space-y-6">
      {/* Resumo Valores Aportados */}
      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[20px] font-heading font-medium">Resumo Valores Aportados (Equalização)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-[15px] min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Sócio</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">% Soc.</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Aportado</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Devolvido</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Saldo Dev.</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">% Atual</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Total p/ Eq.</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] bg-[#F5F5F5]">Aporte Nec.</th>
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Fator</th>
              </tr>
            </thead>
            <tbody>
              {eqComFator.map((e, ei) => (
                <tr key={e.socio_id} className={`border-b border-[#E5E5E5] ${ei % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`} style={{ height: '44px' }}>
                  <td className="py-2 px-3 font-medium">{getSocioNome(e.socio_id)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{e.percentual_sociedade?.toFixed(2)}%</td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatBRL(e.valor_aportado)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatBRL(e.valor_devolvido)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatBRL(e.saldoADevolver)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{(e.percentualAtual * 100).toFixed(2)}%</td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatBRL(e.totalParaEqualizar)}</td>
                  <td className={`text-right py-2 px-3 tabular-nums font-medium bg-[#F5F5F5] ${e.aporteNecessario < 0 ? 'text-primary' : ''}`}>{formatBRL(e.aporteNecessario)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{(e.fatorRateio * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Aportes por Semana */}
      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[20px] font-heading font-medium">Aportes por Semana</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-[15px] min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Sócio</th>
                {semanas.map(s => (
                  <th key={s.id} className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">
                    {s.rotulo || `Sem ${s.numero}`}
                  </th>
                ))}
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] bg-[#F5F5F5]">Total</th>
              </tr>
            </thead>
            <tbody>
              {eqComFator.map((e, ei) => {
                let totalSocio = 0;
                return (
                  <tr key={e.socio_id} className={`border-b border-[#E5E5E5] ${ei % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`} style={{ height: '44px' }}>
                    <td className="py-2 px-3 font-medium">{getSocioNome(e.socio_id)}</td>
                    {semanas.map(s => {
                      const val = aportesSemana[s.id]?.porSocio[e.socio_id] || 0;
                      totalSocio += val;
                      return (
                        <td key={s.id} className={`text-right py-2 px-3 tabular-nums ${val > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {formatBRL(val)}
                        </td>
                      );
                    })}
                    <td className="text-right py-2 px-3 tabular-nums font-semibold bg-[#F5F5F5]">{formatBRL(totalSocio)}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-[#F0F0F0] border-t-2 border-foreground">
                <td className="py-2 px-3 font-semibold">TOTAL</td>
                {semanas.map(s => (
                  <td key={s.id} className="text-right py-2 px-3 tabular-nums font-semibold">
                    {formatBRL(aportesSemana[s.id]?.total || 0)}
                  </td>
                ))}
                <td className="text-right py-2 px-3 tabular-nums font-semibold bg-[#F5F5F5]">
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