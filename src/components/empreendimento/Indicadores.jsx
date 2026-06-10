import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { formatBRL } from '@/lib/calculos';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

export default function Indicadores({ emp, saldoEmp, contasAPagar, aporteNecessario, cicloId }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    saldo_atual: saldoEmp?.saldo_atual || 0,
    saldo_aplicado: saldoEmp?.saldo_aplicado || 0,
    saldo_atual_r21: saldoEmp?.saldo_atual_r21 || 0,
    saldo_decoracao: saldoEmp?.saldo_decoracao || 0,
    inadimplencia: saldoEmp?.inadimplencia || 0,
    observacoes: saldoEmp?.observacoes || ''
  });

  useEffect(() => {
    setForm({
      saldo_atual: saldoEmp?.saldo_atual || 0,
      saldo_aplicado: saldoEmp?.saldo_aplicado || 0,
      saldo_atual_r21: saldoEmp?.saldo_atual_r21 || 0,
      saldo_decoracao: saldoEmp?.saldo_decoracao || 0,
      inadimplencia: saldoEmp?.inadimplencia || 0,
      observacoes: saldoEmp?.observacoes || ''
    });
  }, [saldoEmp]);

  const handleSave = async () => {
    const data = { ...form, empreendimento_id: emp.id, ciclo_id: cicloId };
    if (saldoEmp?.id) {
      await base44.entities.SaldoEmpreendimento.update(saldoEmp.id, data);
    } else {
      await base44.entities.SaldoEmpreendimento.create(data);
    }
    qc.invalidateQueries({ queryKey: ['saldos'] });
    setEditing(false);
  };

  const items = [
    { label: 'Saldo Atual', key: 'saldo_atual', show: true },
    { label: 'Saldo Aplicado', key: 'saldo_aplicado', show: emp.tem_saldo_aplicado },
    { label: 'Saldo Atual R21', key: 'saldo_atual_r21', show: emp.despesa_dividida_r21 },
    { label: 'Saldo Decoração (Bradesco)', key: 'saldo_decoracao', show: emp.tem_saldo_decoracao },
    { label: 'Inadimplência', key: 'inadimplencia', show: emp.tem_inadimplencia },
  ];

  const visibleItems = items.filter(i => i.show);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[20px] font-heading font-medium">Indicadores do Ciclo</h3>
          <Button
            size="sm"
            variant={editing ? 'default' : 'outline'}
            className="text-[15px]"
            onClick={() => editing ? handleSave() : setEditing(true)}
          >
            {editing ? <><Save className="w-4 h-4 mr-1.5" /> Salvar</> : 'Editar'}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visibleItems.map(item => (
            <div key={item.key} className="bg-muted/40 rounded-lg p-4 space-y-2">
              <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium">{item.label}</p>
              {editing ? (
                <Input
                  type="number"
                  step="0.01"
                  value={form[item.key]}
                  onChange={e => setForm({ ...form, [item.key]: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-[15px]"
                />
              ) : (
                <p className={`text-[26px] font-medium font-heading tabular-nums leading-tight ${(form[item.key] || 0) < 0 ? 'text-primary' : ''}`}>
                  {formatBRL(form[item.key])}
                </p>
              )}
            </div>
          ))}

          <div className="bg-muted/40 rounded-lg p-4 space-y-2">
            <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium">Contas a Pagar (Mês)</p>
            <p className="text-[26px] font-medium font-heading tabular-nums leading-tight">{formatBRL(contasAPagar)}</p>
          </div>

          {(emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos') && (
            <div className={`rounded-lg p-4 space-y-2 ${aporteNecessario > 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40'}`}>
              <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium">Aporte Total Nec.</p>
              <p className={`text-[26px] font-medium font-heading tabular-nums leading-tight ${aporteNecessario > 0 ? 'text-primary' : ''}`}>
                {formatBRL(aporteNecessario)}
              </p>
            </div>
          )}
        </div>

        {/* Observações */}
        <div className="mt-6">
          <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-2">Observações</p>
          {editing ? (
            <Textarea
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
              className="text-[15px]"
              rows={2}
            />
          ) : (
            <p className="text-[14px] text-muted-foreground">{form.observacoes || '—'}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}