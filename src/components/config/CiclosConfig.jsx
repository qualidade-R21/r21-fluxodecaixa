import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Pencil, Trash2 } from 'lucide-react';

export default function CiclosConfig() {
  const qc = useQueryClient();
  const { data: ciclos } = useQuery({
    queryKey: ['ciclos'],
    queryFn: () => base44.entities.Ciclo.list('-created_date', 50),
    initialData: [],
  });

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [editId, setEditId] = useState(null);

  const openEdit = (c) => { setNome(c.nome); setEditId(c.id); setOpen(true); };

  const handleSave = async () => {
    if (editId && nome) {
      await base44.entities.Ciclo.update(editId, { nome });
    }
    qc.invalidateQueries({ queryKey: ['ciclos'] });
    setOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Ciclo.delete(id);
    } catch (e) {
      if (!/not found/i.test(e?.message || '')) throw e;
    }
    qc.invalidateQueries({ queryKey: ['ciclos'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-heading">Ciclos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ciclos.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{c.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">
                  {c.status === 'ativo' ? 'ativo' : 'encerrado'}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(c)}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => handleDelete(c.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </div>
          ))}
          {ciclos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum ciclo criado.</p>}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Editar Ciclo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
              <Button onClick={handleSave} disabled={!nome} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}