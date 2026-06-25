import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';
import { formatBRL, calcSaldoSemana } from '@/lib/calculos';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function MoneyInput({ value, onChange, disabled, isCalc }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const handleFocus = () => {
    setEditing(true);
    setRaw(value ? String(value) : '');
  };

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(raw.replace(',', '.')) || 0;
    if (num !== (value || 0)) onChange(num);
  };

  if (disabled) {
    return (
      <span className={`tabular-nums text-[15px] ${(value || 0) < 0 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
        {formatBRL(value || 0)}
      </span>
    );
  }

  return editing ? (
    <Input
      type="text"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="h-8 text-[15px] w-32 text-right"
    />
  ) : (
    <span
      onClick={handleFocus}
      className={`cursor-pointer hover:bg-muted px-1.5 py-0.5 rounded text-[15px] tabular-nums ${(value || 0) < 0 ? 'text-primary font-medium' : ''}`}
    >
      {formatBRL(value || 0)}
    </span>
  );
}

export default function TabelaSemanas({ emp, semanas, lancamentos, saldoEmp, acumulados }) {
  const qc = useQueryClient();

  const handleChange = async (semanaId, field, value) => {
    const lanc = lancamentos.find(l => l.semana_id === semanaId && l.empreendimento_id === emp.id);
    if (lanc) {
      await base44.entities.LancamentoSemanal.update(lanc.id, { [field]: value });
    } else {
      await base44.entities.LancamentoSemanal.create({
        empreendimento_id: emp.id,
        semana_id: semanaId,
        [field]: value
      });
    }
    qc.invalidateQueries({ queryKey: ['lancamentos'] });
  };

  const getLanc = (semanaId) => lancamentos.find(l => l.semana_id === semanaId && l.empreendimento_id === emp.id) || {};

  const columns = [];
  if (emp.despesa_dividida_r21) {
    columns.push({ key: 'despesa_consolidada', label: `Despesa ${emp.nome}`, editable: true });
    columns.push({ key: 'despesa_r21', label: 'Despesa R21', editable: true });
    columns.push({ key: 'despesa_afac', label: 'Previsão (Afac)', editable: false, isAfac: true, isCalc: true });
  } else if (emp.tipo_fluxo === 'multi_projetos') {
    return null;
  } else {
    columns.push({ key: 'despesa_consolidada', label: 'Despesa Cons.', editable: true });
    columns.push({ key: 'despesa_prevista', label: 'Despesa Prev. (AFAC)', editable: true });
    if (emp.tipo_fluxo === 'com_aportes' || emp.tem_previsao_afac) {
      columns.push({ key: 'despesa_afac', label: 'Previsão (Afac)', editable: false, isAfac: true, isCalc: true });
    }
  }

  if (emp.tem_receita !== false) {
    columns.push({ key: 'receita_consolidada', label: 'Receita Cons.', editable: true });
    columns.push({ key: 'receita_prevista', label: 'Receita Prev.', editable: true });
  }

  return (
    <Card>
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-[20px] font-heading font-medium">Fluxo Semanal</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-6 pb-6">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Semana</th>
              {columns.map(col => (
                <th key={col.key} className={`text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] ${col.isCalc ? 'bg-[#F5F5F5]' : ''}`}>
                  {col.label}
                </th>
              ))}
              <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] bg-[#F5F5F5]">Saldo Semana</th>
              <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] bg-[#F5F5F5]">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((s, si) => {
              const lanc = getLanc(s.id);
              const saldoSemana = calcSaldoSemana(lanc, emp);
              const saldoAcum = acumulados[s.id] || 0;

              return (
                <tr key={s.id} className={`border-b border-[#E5E5E5] hover:bg-muted/30 ${si % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`} style={{ height: '44px' }}>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-[13px] font-heading font-medium">{s.rotulo || `Sem ${s.numero}`}</Badge>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className={`text-right py-2 px-3 ${col.isCalc ? 'bg-[#F5F5F5]' : ''}`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {col.isAfac && lanc[col.key] > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-[13px]">Vem dos aportes automáticos</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <MoneyInput
                          value={lanc[col.key]}
                          onChange={(v) => handleChange(s.id, col.key, v)}
                          disabled={!col.editable}
                          isCalc={col.isCalc}
                        />
                      </div>
                    </td>
                  ))}
                  <td className={`text-right py-2 px-3 text-[15px] font-medium tabular-nums bg-[#F5F5F5] ${saldoSemana < 0 ? 'text-primary' : ''}`}>
                    {formatBRL(saldoSemana)}
                  </td>
                  <td className={`text-right py-2 px-3 text-[15px] font-medium tabular-nums bg-[#F5F5F5] ${saldoAcum < 0 ? 'text-primary' : ''}`}>
                    {formatBRL(saldoAcum)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}