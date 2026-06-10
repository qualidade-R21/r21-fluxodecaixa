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
      className="h-7 text-xs w-24 text-right"
    />
  ) : (
    <span
      onClick={handleFocus}
      className="cursor-pointer hover:bg-muted px-1 rounded text-xs tabular-nums"
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
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading">Despesas por Projeto</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-heading text-muted-foreground">Semana</th>
              {projetos.map(p => (
                <th key={p.id} className="text-right py-2 px-2 font-heading text-muted-foreground">{p.nome}</th>
              ))}
              <th className="text-right py-2 px-2 font-heading text-muted-foreground">Total</th>
              <th className="text-right py-2 px-2 font-heading text-muted-foreground">Saldo Acum.</th>
            </tr>
          </thead>
          <tbody>
            {semanas.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-2">
                  <Badge variant="outline" className="text-[10px] font-heading">{s.rotulo || `Sem ${s.numero}`}</Badge>
                </td>
                {projetos.map(p => (
                  <td key={p.id} className="text-right py-2 px-2">
                    <MoneyCell
                      value={getDespesa(p.id, s.id)}
                      onChange={(v) => handleChange(p.id, s.id, v)}
                    />
                  </td>
                ))}
                <td className="text-right py-2 px-2 font-bold tabular-nums">{formatBRL(getSomaSemana(s.id))}</td>
                <td className={`text-right py-2 px-2 font-bold tabular-nums ${(acumulados[s.id] || 0) < 0 ? 'text-primary' : ''}`}>
                  {formatBRL(acumulados[s.id] || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Disponível por projeto */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Saldo Disponível por Projeto</p>
          <div className="flex flex-wrap gap-3">
            {projetos.map(p => (
              <div key={p.id} className="bg-muted rounded px-3 py-2">
                <p className="text-[10px] text-muted-foreground">{p.nome}</p>
                <p className="text-sm font-bold font-heading tabular-nums">{formatBRL(p.saldo_disponivel || 0)}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}