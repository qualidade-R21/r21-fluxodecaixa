import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from '@/lib/calculos';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

function MoneyCell({ value, onChange }) {
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
      {formatBRL(value || 0)}
    </span>
  );
}

export default function TabelaMultiProjetos({ emp, semanas, projetos, despesasProjetos, acumulados }) {
  const qc = useQueryClient();

  const handleChange = async (projetoId, semanaId, valor) => {
    const existing = despesasProjetos.find(d => d.projeto_id === projetoId && d.semana_id === semanaId);
    if (existing) {
      await base44.entities.DespesaProjetoSemanal.update(existing.id, { valor_despesa: valor });
    } else {
      await base44.entities.DespesaProjetoSemanal.create({ projeto_id: projetoId, semana_id: semanaId, valor_despesa: valor });
    }
    qc.invalidateQueries({ queryKey: ['despesas-projetos'] });
    qc.invalidateQueries({ queryKey: ['lancamentos'] });
  };

  const getDespesa = (projetoId, semanaId) => {
    return despesasProjetos.find(d => d.projeto_id === projetoId && d.semana_id === semanaId)?.valor_despesa || 0;
  };

  const getSomaSemana = (semanaId) => {
    return projetos.reduce((sum, p) => sum + getDespesa(p.id, semanaId), 0);
  };

  return (
    <Card>
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-[20px] font-heading font-medium">Despesas por Projeto</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-6 pb-6">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Semana</th>
              {projetos.map(p => (
                <th key={p.id} className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">{p.nome}</th>
              ))}
              <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] bg-[#F5F5F5]">Total</th>
              <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] bg-[#F5F5F5]">Saldo Acum.</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map((s, si) => (
              <tr key={s.id} className={`border-b border-[#E5E5E5] hover:bg-muted/30 ${si % 2 === 0 ? 'bg-[#FAFAFA]' : 'bg-white'}`} style={{ height: '44px' }}>
                <td className="py-2 px-3">
                  <Badge variant="outline" className="text-[13px] font-heading font-medium flex flex-col items-start gap-0.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground leading-none">SEMANA {s.numero}</span>
                    <span className="leading-none">{s.rotulo || `Sem ${s.numero}`}</span>
                  </Badge>
                </td>
                {projetos.map(p => (
                  <td key={p.id} className="text-right py-2 px-3">
                    <MoneyCell
                      value={getDespesa(p.id, s.id)}
                      onChange={(v) => handleChange(p.id, s.id, v)}
                    />
                  </td>
                ))}
                <td className="text-right py-2 px-3 text-[15px] font-medium tabular-nums bg-[#F5F5F5]">{formatBRL(getSomaSemana(s.id))}</td>
                <td className={`text-right py-2 px-3 text-[15px] font-medium tabular-nums ${(acumulados[s.id] || 0) < 0 ? 'bg-red-100 text-primary' : 'bg-green-100'}`}>
                  {formatBRL(acumulados[s.id] || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-[#F5F5F5]" style={{ height: '44px' }}>
              <td className="py-2 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A] font-medium">Total</td>
              {projetos.map(p => {
                const somaProjetos = semanas.reduce((sum, s) => sum + getDespesa(p.id, s.id), 0);
                return (
                  <td key={p.id} className="text-right py-2 px-3 text-[15px] font-medium tabular-nums">
                    {formatBRL(somaProjetos)}
                  </td>
                );
              })}
              <td className="text-right py-2 px-3 text-[15px] font-semibold tabular-nums bg-[#F0F0F0]">
                {formatBRL(semanas.reduce((sum, s) => sum + getSomaSemana(s.id), 0))}
              </td>
              <td className="text-right py-2 px-3 bg-[#F0F0F0]"></td>
            </tr>
          </tfoot>
          </table>
      </CardContent>
    </Card>
  );
}