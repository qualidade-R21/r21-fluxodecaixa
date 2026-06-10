import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useParticipacoes, useSocios, useEmpreendimentos } from '@/lib/useFluxoData';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { formatBRL } from '@/lib/calculos';

export default function ParticipacaoConfig() {
  const qc = useQueryClient();
  const { data: parts } = useParticipacoes();
  const { data: socios } = useSocios();
  const { data: emps } = useEmpreendimentos();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ socio_id: '', empreendimento_id: '', percentual_sociedade: 0, valor_aportado: 0, valor_devolvido: 0 });
  const [editId, setEditId] = useState(null);

  const openNew = () => { setForm({ socio_id: '', empreendimento_id: '', percentual_sociedade: 0, valor_aportado: 0, valor_devolvido: 0 }); setEditId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...p }); setEditId(p.id); setOpen(true); };

  const handleSave = async () => {
    const data = { socio_id: form.socio_id, empreendimento_id: form.empreendimento_id, percentual_sociedade: form.percentual_sociedade, valor_aportado: form.valor_aportado, valor_devolvido: form.valor_devolvido };
    if (editId) {
      await base44.entities.Participacao.update(editId, data);
    } else {
      await base44.entities.Participacao.create(data);
    }
    qc.invalidateQueries({ queryKey: ['participacoes'] });
    setOpen(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Participacao.delete(id);
    qc.invalidateQueries({ queryKey: ['participacoes'] });
  };

  const getSocio = (id) => socios.find(s => s.id === id)?.nome || '—';
  const getEmp = (id) => emps.find(e => e.id === id)?.nome || '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Participações</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-3 h-3 mr-1" /> Nova</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2">Empreendimento</th>
              <th className="text-left py-2 px-2">Sócio</th>
              <th className="text-right py-2 px-2">%</th>
              <th className="text-right py-2 px-2">Aportado</th>
              <th className="text-right py-2 px-2">Devolvido</th>
              <th className="text-right py-2 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-2 px-2">{getEmp(p.empreendimento_id)}</td>
                <td className="py-2 px-2">{getSocio(p.socio_id)}</td>
                <td className="text-right py-2 px-2 tabular-nums">{p.percentual_sociedade}%</td>
                <td className="text-right py-2 px-2 tabular-nums">{formatBRL(p.valor_aportado)}</td>
                <td className="text-right py-2 px-2 tabular-nums">{formatBRL(p.valor_devolvido)}</td>
                <td className="text-right py-2 px-2">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editId ? 'Editar' : 'Nova'} Participação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Empreendimento</Label>
                <Select value={form.empreendimento_id} onValueChange={v => setForm({...form, empreendimento_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{emps.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sócio</Label>
                <Select value={form.socio_id} onValueChange={v => setForm({...form, socio_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{socios.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">% Sociedade</Label><Input type="number" step="0.01" value={form.percentual_sociedade} onChange={e => setForm({...form, percentual_sociedade: parseFloat(e.target.value) || 0})} /></div>
                <div><Label className="text-xs">Aportado</Label><Input type="number" step="0.01" value={form.valor_aportado} onChange={e => setForm({...form, valor_aportado: parseFloat(e.target.value) || 0})} /></div>
                <div><Label className="text-xs">Devolvido</Label><Input type="number" step="0.01" value={form.valor_devolvido} onChange={e => setForm({...form, valor_devolvido: parseFloat(e.target.value) || 0})} /></div>
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}