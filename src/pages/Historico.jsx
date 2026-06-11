import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpreendimentos } from '@/lib/useFluxoData';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRL } from '@/lib/calculos';
import { Eye, History, Calendar, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Historico() {
  const navigate = useNavigate();
  const { data: empreendimentos } = useEmpreendimentos();
  const [filtroEmp, setFiltroEmp] = useState('todos');

  const { data: versoes, isLoading } = useQuery({
    queryKey: ['versoesSemanais'],
    queryFn: () => base44.entities.VersaoSemanal.list('-created_date', 50),
  });

  const filtered = filtroEmp === 'todos'
    ? versoes || []
    : (versoes || []).filter(v => {
        const snapshot = v.snapshot || {};
        const empIds = (snapshot.empreendimentos || []).map(e => e.id);
        return empIds.includes(filtroEmp);
      });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-heading font-bold">Histórico</h1>
        <p className="text-muted-foreground text-[15px] mt-1">Versões semanais arquivadas — somente leitura</p>
      </div>

      <div className="flex items-center gap-4">
        <Select value={filtroEmp} onValueChange={setFiltroEmp}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filtrar por empreendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os empreendimentos</SelectItem>
            {(empreendimentos || []).map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[14px] text-muted-foreground">{filtered.length} versões encontradas</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-[15px]">Nenhuma versão arquivada encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(versao => {
            const resumo = versao.resumo || {};
            const empsNoSnapshot = (versao.snapshot?.empreendimentos || []).filter(
              e => filtroEmp === 'todos' || e.id === filtroEmp
            );

            return (
              <Card key={versao.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 px-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-black rounded flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-[16px] font-heading">
                          {versao.data_referencia}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-[13px] text-muted-foreground mt-0.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{versao.created_by || '—'}</span>
                          <span>•</span>
                          <span>{new Date(versao.created_date).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => navigate(`/historico/${versao.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                      Visualizar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {empsNoSnapshot.map(emp => {
                      const empResumo = resumo[emp.id] || {};
                      return (
                        <div key={emp.id} className="bg-muted/50 rounded-lg p-4">
                          <p className="text-[14px] font-heading font-bold mb-2">{emp.nome}</p>
                          <div className="space-y-1 text-[13px]">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Saldo Atual:</span>
                              <span className="font-medium tabular-nums">{formatBRL(empResumo.saldoAtual || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Contas a Pagar:</span>
                              <span className="font-medium tabular-nums">{formatBRL(empResumo.contasAPagar || 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}