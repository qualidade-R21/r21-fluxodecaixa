import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSocios } from '@/lib/useFluxoData';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SociosConfig() {
  const qc = useQueryClient();
  const { data: socios } = useSocios();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [vinculado, setVinculado] = useState(false);
  const [editId, setEditId] = useState(null);

  const openNew = () => { setNome(''); setVinculado(false); setEditId(null); setOpen(true); };
  const openEdit = (s) => { setNome(s.nome); setVinculado(s.vinculado_a_ricardo || false); setEditId(s.id); setOpen(true); };

  const handleSave = async () => {
    if (editId) {
      await base44.entities.Socio.update(editId, { nome, vinculado_a_ricardo: vinculado });
    } else {
      await base44.entities.Socio.create({ nome, vinculado_a_ricardo: vinculado });
    }
    qc.invalidateQueries({ queryKey: ['socios'] });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Sócios</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-3 h-3 mr-1" /> Novo</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {socios.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{s.nome}</span>
                {s.vinculado_a_ricardo && <Badge variant="outline" className="text-[10px]">Vinculado Ricardo</Badge>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-3 h-3" /></Button>
            </div>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">{editId ? 'Editar' : 'Novo'} Sócio</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vinculado a Ricardo</Label>
                <Switch checked={vinculado} onCheckedChange={setVinculado} />
              </div>
              <Button onClick={handleSave} disabled={!nome} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}