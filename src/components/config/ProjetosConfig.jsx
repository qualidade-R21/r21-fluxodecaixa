import React, { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpreendimentos } from '@/lib/useFluxoData';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { formatBRL } from '@/lib/calculos';

export default function ProjetosConfig() {
  const qc = useQueryClient();
  const { data: emps } = useEmpreendimentos();
  const multiEmps = emps.filter(e => e.tipo_fluxo === 'multi_projetos');
  
  const { data: projetos } = useQuery({
    queryKey: ['all-projetos'],
    queryFn: () => base44.entities.ProjetoInterno.list('nome', 100),
    initialData: [],
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ empreendimento_pai_id: '', nome: '', saldo_disponivel: 0 });
  const [editId, setEditId] = useState(null);

  const openNew = () => { setForm({ empreendimento_pai_id: multiEmps[0]?.id || '', nome: '', saldo_disponivel: 0 }); setEditId(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...p }); setEditId(p.id); setOpen(true); };

  const handleDelete = async (id) => {
    await base44.entities.ProjetoInterno.delete(id);
    qc.invalidateQueries({ queryKey: ['all-projetos'] });
    qc.invalidateQueries({ queryKey: ['projetos-internos'] });
  };

  const handleSave = async () => {
    const data = { empreendimento_pai_id: form.empreendimento_pai_id, nome: form.nome, saldo_disponivel: form.saldo_disponivel };
    if (editId) {
      await base44.entities.ProjetoInterno.update(editId, data);
    } else {
      await base44.entities.ProjetoInterno.create(data);
    }
    qc.invalidateQueries({ queryKey: ['all-projetos'] });
    qc.invalidateQueries({ queryKey: ['projetos-internos'] });
    setOpen(false);
  };

  const getEmp = (id) => emps.find(e => e.id === id)?.nome || '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Projetos Internos</CardTitle>
        <Button size="sm" onClick={openNew} disabled={multiEmps.length === 0}><Plus className="w-3 h-3 mr-1" /> Novo</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {projetos.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{p.nome}</span>
                <span className="text-xs text-muted-foreground">({getEmp(p.empreendimento_pai_id)})</span>
                <span className="text-xs tabular-nums">{formatBRL(p.saldo_disponivel)}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
          {projetos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum projeto criado.</p>}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editId ? 'Editar' : 'Novo'} Projeto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Empreendimento Pai</Label>
                <Select value={form.empreendimento_pai_id} onValueChange={v => setForm({...form, empreendimento_pai_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{multiEmps.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
              <div><Label className="text-xs">Saldo Disponível</Label><Input type="number" step="0.01" value={form.saldo_disponivel} onChange={e => setForm({...form, saldo_disponivel: parseFloat(e.target.value) || 0})} /></div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}