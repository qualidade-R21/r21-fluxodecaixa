import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { formatBRL, calcEqualizacao, calcFatorRateio, calcAportesPorSemana, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';

function MoneyCell({ value, onChange, suffix }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const handleFocus = () => {
    setEditing(true);
    setRaw(value ? String(value) : '');
  };

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
    if (num !== (value || 0)) onChange(num);
  };

  const displayValue = suffix === '%'
    ? `${(value || 0).toFixed(2)}%`
    : formatBRL(value || 0);

  return editing ? (
    <Input
      type="text"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="h-8 text-[15px] w-28 text-right"
    />
  ) : (
    <span
      onClick={handleFocus}
      className="cursor-pointer hover:bg-muted px-1.5 py-0.5 rounded text-[15px] tabular-nums"
    >
      {displayValue}
    </span>
  );
}

export default function AportesSection({ emp, semanas, lancamentos, saldoEmp, participacoes, socios, despesasPorSemana, projetosInternos, acumulados }) {
  const qc = useQueryClient();
  const [showFator, setShowFator] = useState(true);
  if (emp.tipo_fluxo !== 'com_aportes' && emp.tipo_fluxo !== 'multi_projetos') return null;

  const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);

  const handleParticipacaoChange = async (participacaoId, field, valor) => {
    await base44.entities.Participacao.update(participacaoId, { [field]: valor });
    qc.invalidateQueries({ queryKey: ['participacoes'] });
  };
  if (empParts.length === 0) return null;

  const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
  const contasAPagar = calcContasAPagar(empLancs, semanas, emp, despesasPorSemana || {}, 4);

  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp.tipo_fluxo === 'multi_projetos' && projetosInternos?.length > 0) {
    saldoAtual = projetosInternos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }

  const aporteTotal = calcAporteTotalNecessario(contasAPagar, saldoAtual, emp.margem_aporte_total || 0);
  const equalizacao = calcEqualizacao(empParts, aporteTotal, emp, socios);
  const eqComFator = calcFatorRateio(equalizacao, aporteTotal);
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
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">
                  <div className="flex flex-col items-end gap-1">
                    <span className={showFator ? '' : 'text-muted-foreground/50'}>Fator</span>
                    <div className="flex items-center gap-1.5 normal-case">
                      <Switch checked={showFator} onCheckedChange={setShowFator} className="scale-75" />
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {eqComFator.map((e, ei) => (
                <tr key={e.socio_id} className={`border-b border-[#E5E5E5] ${ei % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`} style={{ height: '44px' }}>
                  <td className="py-2 px-3 font-medium">{getSocioNome(e.socio_id)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    <MoneyCell value={e.percentual_sociedade} onChange={(v) => handleParticipacaoChange(e.id, 'percentual_sociedade', v)} suffix="%" />
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    <MoneyCell value={e.valor_aportado} onChange={(v) => handleParticipacaoChange(e.id, 'valor_aportado', v)} />
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">
                    <MoneyCell value={e.valor_devolvido} onChange={(v) => handleParticipacaoChange(e.id, 'valor_devolvido', v)} />
                  </td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatBRL(e.saldoADevolver)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{(e.percentualAtual * 100).toFixed(2)}%</td>
                  <td className="text-right py-2 px-3 tabular-nums">{formatBRL(e.totalParaEqualizar)}</td>
                  <td className={`text-right py-2 px-3 tabular-nums font-medium bg-[#F5F5F5] ${e.aporteNecessario < 0 ? 'text-primary' : ''}`}>{formatBRL(e.aporteNecessario)}</td>
                  <td className="text-right py-2 px-3 tabular-nums">{showFator ? `${(e.fatorRateio * 100).toFixed(2)}%` : '—'}</td>
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
                    <span className="block text-[11px] text-muted-foreground leading-none mb-0.5">SEMANA {s.numero}</span>
                    <span className="leading-none">{s.rotulo || `Sem ${s.numero}`}</span>
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