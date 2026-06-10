import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';
import { formatBRL, calcSaldoSemana } from '@/lib/calculos';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function MoneyInput({ value, onChange, disabled, className }) {
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
    return <span className={className}>{formatBRL(value || 0)}</span>;
  }

  return editing ? (
    <Input
      type="text"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="h-7 text-xs w-28 text-right"
    />
  ) : (
    <span
      onClick={handleFocus}
      className={`cursor-pointer hover:bg-muted px-1 rounded text-xs tabular-nums ${className}`}
    >
      {formatBRL(value || 0)}
    </span>
  );
}

export default function TabelaSemanas({ emp, semanas, lancamentos, saldoEmp, acumulados, onUpdate }) {
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

  // Build columns based on tipo_fluxo
  const columns = [];
  if (emp.despesa_dividida_r21) {
    columns.push({ key: 'despesa_consolidada', label: 'Despesa GTR', editable: true });
    columns.push({ key: 'despesa_r21', label: 'Despesa R21', editable: true });
    columns.push({ key: 'despesa_afac', label: 'Previsão (Afac)', editable: false, isAfac: true });
  } else if (emp.tipo_fluxo === 'multi_projetos') {
    // handled in a different component
    return null;
  } else {
    columns.push({ key: 'despesa_consolidada', label: 'Despesa Cons.', editable: true });
    columns.push({ key: 'despesa_prevista', label: 'Despesa Prev.', editable: true });
    if (emp.tipo_fluxo === 'com_aportes') {
      columns.push({ key: 'despesa_afac', label: 'Previsão (Afac)', editable: false, isAfac: true });
    }
  }

  if (emp.tem_receita !== false) {
    columns.push({ key: 'receita_consolidada', label: 'Receita Cons.', editable: true });
    columns.push({ key: 'receita_prevista', label: 'Receita Prev.', editable: true });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading">Fluxo Semanal</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-heading font-bold text-muted-foreground">Semana</th>
              {columns.map(col => (
                <th key={col.key} className="text-right py-2 px-2 font-heading font-bold text-muted-foreground">
                  {col.label}
                </th>
              ))}
              <th className="text-right py-2 px-2 font-heading font-bold text-muted-foreground">Saldo Semana</th>
              <th className="text-right py-2 px-2 font-heading font-bold text-muted-foreground">Saldo Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map(s => {
              const lanc = getLanc(s.id);
              const saldoSemana = calcSaldoSemana(lanc, emp);
              const saldoAcum = acumulados[s.id] || 0;

              return (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-2">
                    <Badge variant="outline" className="text-[10px] font-heading">{s.rotulo || `Sem ${s.numero}`}</Badge>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="text-right py-2 px-2">
                      <div className="flex items-center justify-end gap-1">
                        {col.isAfac && lanc[col.key] > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Link2 className="w-3 h-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Vem dos aportes automáticos</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <MoneyInput
                          value={lanc[col.key]}
                          onChange={(v) => handleChange(s.id, col.key, v)}
                          disabled={!col.editable}
                          className={lanc[col.key] < 0 ? 'text-primary' : ''}
                        />
                      </div>
                    </td>
                  ))}
                  <td className={`text-right py-2 px-2 font-bold tabular-nums ${saldoSemana < 0 ? 'text-primary' : ''}`}>
                    {formatBRL(saldoSemana)}
                  </td>
                  <td className={`text-right py-2 px-2 font-bold tabular-nums ${saldoAcum < 0 ? 'text-primary' : ''}`}>
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