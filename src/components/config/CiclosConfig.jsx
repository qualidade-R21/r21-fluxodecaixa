import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

export default function CiclosConfig() {
  const { data: ciclos } = useQuery({
    queryKey: ['ciclos'],
    queryFn: () => base44.entities.Ciclo.list('-created_date', 50),
    initialData: [],
  });

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
              <Badge variant={c.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">
                {c.status === 'ativo' ? 'ativo' : 'encerrado'}
              </Badge>
            </div>
          ))}
          {ciclos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum ciclo criado.</p>}
        </div>
      </CardContent>
    </Card>
  );
}