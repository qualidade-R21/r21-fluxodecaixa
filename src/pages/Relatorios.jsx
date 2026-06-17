import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { gerarPDFGeral, gerarPDFEmpreendimento } from '@/lib/gerarPDF';

export default function Relatorios() {
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const qc = useQueryClient();
  const { data: semanas } = useSemanas(cicloAtivo?.id);
  const semanaIds = useMemo(() => semanas.map(s => s.id), [semanas]);
  const { data: lancamentos } = useLancamentos(cicloAtivo?.id, semanaIds);
  const { data: saldos } = useSaldos(cicloAtivo?.id);
  const { data: socios } = useSocios();
  const { data: participacoes } = useParticipacoes();
  const { data: allProjetos } = useProjetosInternos(
    empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos')?.id
  );
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);

  const { data: versoes } = useQuery({
    queryKey: ['versoesSemanais'],
    queryFn: () => base44.entities.VersaoSemanal.list('-created_date', 50),
  });

  const semanasOrdenadas = useMemo(() =>
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  const empAtivos = useMemo(() =>
    empreendimentos.filter(e => e.ativo !== false), [empreendimentos]
  );

  const empData = useMemo(() => {
    const data = {};
    empAtivos.forEach(emp => {
      const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
      const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
      const projetos = emp.tipo_fluxo === 'multi_projetos' ? allProjetos : [];

      const despPorSemana = {};
      if (emp.tipo_fluxo === 'multi_projetos') {
        const projetoIds = projetos.map(p => p.id);
        semanasOrdenadas.forEach(s => {
          despPorSemana[s.id] = despesasProjetos
            .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
            .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
        });
      }

      const acumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, semanasOrdenadas, despPorSemana, projetos);
      const contasAPagar = calcContasAPagar(empLancs, semanasOrdenadas, despPorSemana);

      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
        saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }

      const aporteNecessario = (emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos')
        ? calcAporteTotalNecessario(contasAPagar, saldoAtual, emp.margem_aporte_total || 0)
        : 0;

      data[emp.id] = { saldoAtual, contasAPagar, aporteNecessario, acumulados, projetos, despPorSemana };
    });
    return data;
  }, [empAtivos, lancamentos, saldos, semanasOrdenadas, allProjetos, despesasProjetos]);

  const handleGerarPDFGeral = () => {
    gerarPDFGeral({
      empreendimentos: empAtivos, saldos, semanas: semanasOrdenadas,
      lancamentos, allProjetos, despesasProjetos, participacoes, socios,
      cicloAtivo, empData
    });
  };

  const handleGerarPDFEmpreendimento = (emp) => {
    const d = empData[emp.id] || {};
    gerarPDFEmpreendimento({
      emp,
      saldoEmp: saldos.find(s => s.empreendimento_id === emp.id),
      semanas: semanasOrdenadas,
      lancamentos: lancamentos.filter(l => l.empreendimento_id === emp.id),
      projetos: d.projetos || [],
      despesasProjetos,
      acumulados: d.acumulados || {},
      contasAPagar: d.contasAPagar || 0,
      aporteNecessario: d.aporteNecessario || 0,
      participacoes, socios, cicloAtivo
    });
  };

  const handleGerarPDFVersao = (versao) => {
    const snap = versao.snapshot || {};
    gerarPDFGeral({
      empreendimentos: snap.empreendimentos || [],
      saldos: snap.saldos || [],
      semanas: (snap.semanas || []).sort((a, b) => a.numero - b.numero),
      lancamentos: snap.lancamentos || [],
      allProjetos: snap.projetos || [],
      despesasProjetos: snap.despesasProjetos || [],
      participacoes: snap.participacoes || [],
      socios: snap.socios || [],
      cicloAtivo: { id: snap.ciclo_id, nome: `Versão ${versao.data_referencia}` },
      empData: {}
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-heading font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-[15px] mt-1">Geração de PDFs e histórico de importações</p>
      </div>

      {/* PDF Versão Atual */}
      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[18px] font-heading font-medium">Gerar PDF — Versão Atual</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="default" onClick={handleGerarPDFGeral} className="gap-2">
              <FileDown className="w-4 h-4" />
              PDF Geral
            </Button>
            {empAtivos.map(emp => (
              <Button key={emp.id} variant="outline" onClick={() => handleGerarPDFEmpreendimento(emp)} className="gap-2">
                <FileDown className="w-4 h-4" />
                PDF {emp.nome}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PDF Versões Arquivadas */}
      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[18px] font-heading font-medium">Gerar PDF — Versão Arquivada</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {(versoes || []).length === 0 ? (
            <p className="text-muted-foreground text-[14px]">Nenhuma versão arquivada disponível.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {(versoes || []).map(v => (
                <Button key={v.id} variant="outline" onClick={() => handleGerarPDFVersao(v)} className="gap-2">
                  <FileText className="w-4 h-4" />
                  {v.data_referencia}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log de Importações */}
      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[18px] font-heading font-medium">Log de Importações Sienge</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ImportLog />
        </CardContent>
      </Card>

      {/* Limpar dados de teste */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[18px] font-heading font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Limpar dados de teste
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <p className="text-[14px] text-muted-foreground mb-4">
            Remove todos os lançamentos, saldos, versões arquivadas e logs de importação. Use para zerar o app e recomeçar.
            Empreendimentos, ciclos, sócios e projetos internos <strong>não</strong> serão afetados.
          </p>
          <Button variant="destructive" onClick={() => setShowCleanup(true)} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Zerar todos os dados
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showCleanup} onOpenChange={setShowCleanup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar exclusão total
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação vai <strong>excluir permanentemente</strong> todos os lançamentos semanais, saldos, versões arquivadas e logs de importação.
              Não será possível desfazer. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cleaning}
              onClick={async () => {
                setCleaning(true);
                try {
                  await base44.functions.invoke('limparDadosTeste', {});
                  qc.invalidateQueries();
                } finally {
                  setCleaning(false);
                  setShowCleanup(false);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cleaning ? 'Limpando...' : 'Sim, excluir tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ImportLog() {
  const { data: registros } = useQuery({
    queryKey: ['registrosImportacao'],
    queryFn: () => base44.entities.RegistroImportacao.list('-created_date', 30),
  });
  const { data: empreendimentos } = useEmpreendimentos();

  const getEmpNome = (empId) => {
    const emp = empreendimentos?.find(e => e.id === empId);
    return emp?.nome || empId;
  };

  if (!registros || registros.length === 0) {
    return <p className="text-muted-foreground text-[14px]">Nenhuma importação registrada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="text-left py-2 px-3 font-heading text-[12px] uppercase tracking-wide text-[#4A4A4A]">Data</th>
            <th className="text-left py-2 px-3 font-heading text-[12px] uppercase tracking-wide text-[#4A4A4A]">Empreendimento</th>
            <th className="text-left py-2 px-3 font-heading text-[12px] uppercase tracking-wide text-[#4A4A4A]">Arquivo</th>
            <th className="text-left py-2 px-3 font-heading text-[12px] uppercase tracking-wide text-[#4A4A4A]">Tipo</th>
            <th className="text-left py-2 px-3 font-heading text-[12px] uppercase tracking-wide text-[#4A4A4A]">Usuário</th>
            <th className="text-center py-2 px-3 font-heading text-[12px] uppercase tracking-wide text-[#4A4A4A] w-[100px]">Visualizar</th>
          </tr>
        </thead>
        <tbody>
          {registros.map(r => (
            <tr key={r.id} className="border-b border-border">
              <td className="py-2 px-3 whitespace-nowrap">{new Date(r.created_date).toLocaleString('pt-BR')}</td>
              <td className="py-2 px-3 whitespace-nowrap">{getEmpNome(r.empreendimento_id)}</td>
              <td className="py-2 px-3 truncate max-w-[200px]">{r.nome_arquivo}</td>
              <td className="py-2 px-3 capitalize">{r.tipo}</td>
              <td className="py-2 px-3">{r.usuario || '—'}</td>
              <td className="py-2 px-3 text-center">
                {r.file_url ? (
                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[13px] font-medium">
                    Abrir PDF
                  </a>
                ) : (
                  <span className="text-muted-foreground text-[13px]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}