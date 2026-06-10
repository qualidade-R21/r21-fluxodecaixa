import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Archive, Calendar } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { useCicloAtivo, useEmpreendimentos, useSemanas, useSaldos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados } from '@/lib/calculos';

export default function CiclosConfig() {
  const qc = useQueryClient();
  const { data: ciclos } = useQuery({
    queryKey: ['ciclos'],
    queryFn: () => base44.entities.Ciclo.list('-created_date', 50),
    initialData: [],
  });
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanas } = useSemanas(cicloAtivo?.id);

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState('');

  const handleCreate = async () => {
    const ciclo = await base44.entities.Ciclo.create({ nome, status: 'ativo' });
    // Create 6 semanas
    const start = parseISO(dataInicio);
    for (let i = 0; i < 6; i++) {
      const inicio = addDays(start, i * 7);
      const fim = addDays(inicio, 6);
      const rotulo = `${format(inicio, 'dd/MM')} - ${format(fim, 'dd/MM')}`;
      await base44.entities.Semana.create({
        ciclo_id: ciclo.id,
        numero: i + 1,
        data_inicio: format(inicio, 'yyyy-MM-dd'),
        data_fim: format(fim, 'yyyy-MM-dd'),
        rotulo
      });
    }
    qc.invalidateQueries({ queryKey: ['ciclos'] });
    qc.invalidateQueries({ queryKey: ['ciclo-ativo'] });
    qc.invalidateQueries({ queryKey: ['semanas'] });
    setOpen(false);
    setNome('');
    setDataInicio('');
  };

  const handleEncerrar = async () => {
    if (!cicloAtivo) return;
    // Archive current cycle
    await base44.entities.Ciclo.update(cicloAtivo.id, { status: 'encerrado' });
    qc.invalidateQueries({ queryKey: ['ciclos'] });
    qc.invalidateQueries({ queryKey: ['ciclo-ativo'] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-heading">Ciclos</CardTitle>
        <div className="flex gap-2">
          {cicloAtivo && (
            <Button variant="outline" size="sm" onClick={handleEncerrar}>
              <Archive className="w-3 h-3 mr-1" /> Encerrar ciclo
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-3 h-3 mr-1" /> Novo Ciclo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Novo Ciclo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Maio–Junho 2026" />
                </div>
                <div>
                  <Label className="text-xs">Data de início da Semana 1</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <Button onClick={handleCreate} disabled={!nome || !dataInicio} className="w-full">Criar Ciclo</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ciclos.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{c.nome}</span>
              </div>
              <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">
                {c.status}
              </Badge>
            </div>
          ))}
          {ciclos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum ciclo criado.</p>}
        </div>
      </CardContent>
    </Card>
  );
}