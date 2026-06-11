import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpreendimentos } from '@/lib/useFluxoData';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const defaultEmp = {
  nome: '', nome_sienge: '', tipo_fluxo: 'simples', tem_receita: true, tem_saldo_aplicado: false,
  tem_saldo_decoracao: false, tem_inadimplencia: false, despesa_dividida_r21: false,
  margem_seguranca_semana1: 0, margem_seguranca_demais: 0, margem_aporte_total: 0,
  banco_principal: '', observacoes: '', ativo: true, ordem_exibicao: 0
};

export default function EmpreendimentosConfig() {
  const qc = useQueryClient();
  const { data: emps } = useEmpreendimentos();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultEmp);
  const [editId, setEditId] = useState(null);

  const openNew = () => { setForm(defaultEmp); setEditId(null); setOpen(true); };
  const openEdit = (emp) => { setForm({ ...defaultEmp, ...emp }); setEditId(emp.id); setOpen(true); };

  const handleDelete = async (id) => {
    await base44.entities.Empreendimento.delete(id);
    qc.invalidateQueries({ queryKey: ['empreendimentos'] });
  };

  const handleSave = async () => {
    const data = { ...form };
    delete data.id; delete data.created_date; delete data.updated_date; delete data.created_by_id;
    if (editId) {
      await base44.entities.Empreendimento.update(editId, data);
    } else {
      await base44.entities.Empreendimento.create(data);
    }
    qc.invalidateQueries({ queryKey: ['empreendimentos'] });
    setOpen(false);
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Empreendimentos</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-3 h-3 mr-1" /> Novo</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {emps.map(emp => (
            <div key={emp.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{emp.nome}</span>
                <Badge variant="outline" className="text-[10px] capitalize">{emp.tipo_fluxo?.replace('_', ' ')}</Badge>
                {!emp.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleDelete(emp.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">{editId ? 'Editar' : 'Novo'} Empreendimento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={e => set('nome', e.target.value)} /></div>
                <div><Label className="text-xs">Nome Sienge</Label><Input value={form.nome_sienge} onChange={e => set('nome_sienge', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo de Fluxo</Label>
                  <Select value={form.tipo_fluxo} onValueChange={v => set('tipo_fluxo', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Simples</SelectItem>
                      <SelectItem value="com_aportes">Com Aportes</SelectItem>
                      <SelectItem value="multi_projetos">Multi Projetos</SelectItem>
                      <SelectItem value="master">Master</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Banco Principal</Label><Input value={form.banco_principal} onChange={e => set('banco_principal', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Margem Sem. 1</Label><Input type="number" value={form.margem_seguranca_semana1} onChange={e => set('margem_seguranca_semana1', parseFloat(e.target.value) || 0)} /></div>
                <div><Label className="text-xs">Margem Demais</Label><Input type="number" value={form.margem_seguranca_demais} onChange={e => set('margem_seguranca_demais', parseFloat(e.target.value) || 0)} /></div>
                <div><Label className="text-xs">Margem Aporte Total</Label><Input type="number" value={form.margem_aporte_total} onChange={e => set('margem_aporte_total', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div><Label className="text-xs">Ordem Exibição</Label><Input type="number" value={form.ordem_exibicao} onChange={e => set('ordem_exibicao', parseInt(e.target.value) || 0)} /></div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['tem_receita', 'Tem Receita'], ['tem_saldo_aplicado', 'Saldo Aplicado'],
                  ['tem_saldo_decoracao', 'Saldo Decoração'], ['tem_inadimplencia', 'Inadimplência'],
                  ['despesa_dividida_r21', 'Despesa Dividida R21'], ['ativo', 'Ativo']
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-xs">{label}</Label>
                    <Switch checked={form[key]} onCheckedChange={v => set(key, v)} />
                  </div>
                ))}
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}