import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes } from '@/lib/useFluxoData';
import { calcSaldosAcumulados, calcContasAPagar, calcAporteTotalNecessario, formatBRL } from '@/lib/calculos';
import TabelaSemanas from '@/components/empreendimento/TabelaSemanas';
import TabelaMultiProjetos from '@/components/empreendimento/TabelaMultiProjetos';
import Indicadores from '@/components/empreendimento/Indicadores';
import AportesSection from '@/components/empreendimento/AportesSection';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, Lock } from 'lucide-react';

export default function HistoricoVersao() {
  const { versaoId } = useParams();
  const [comparando, setComparando] = useState(false);

  const { data: versao } = useQuery({
    queryKey: ['versaoSemanal', versaoId],
    queryFn: () => base44.entities.VersaoSemanal.get(versaoId),
    enabled: !!versaoId,
  });

  // Live data for comparison
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanasLive } = useSemanas(cicloAtivo?.id);
  const semanaIdsLive = useMemo(() => (semanasLive || []).map(s => s.id), [semanasLive]);
  const { data: lancamentosLive } = useLancamentos(cicloAtivo?.id, semanaIdsLive);
  const { data: saldosLive } = useSaldos(cicloAtivo?.id);
  const { data: sociosLive } = useSocios();
  const { data: participacoesLive } = useParticipacoes();

  const semanasLiveOrd = useMemo(() =>
    [...(semanasLive || [])].sort((a, b) => a.numero - b.numero), [semanasLive]
  );

  const snap = versao?.snapshot || {};
  const snapSemanas = (snap.semanas || []).sort((a, b) => a.numero - b.numero);
  const snapEmps = snap.empreendimentos || [];
  const snapLancamentos = snap.lancamentos || [];
  const snapSaldos = snap.saldos || [];
  const snapProjetos = snap.projetos || [];
  const snapDespesas = snap.despesasProjetos || [];
  const snapParticipacoes = snap.participacoes || [];
  const snapSocios = snap.socios || [];

  // Compute comparison
  const comparacao = useMemo(() => {
    if (!comparando || !versao) return null;
    const result = {};
    snapEmps.forEach(emp => {
      const snapLancs = snapLancamentos.filter(l => l.empreendimento_id === emp.id);
      const liveLancs = (lancamentosLive || []).filter(l => l.empreendimento_id === emp.id);
      result[emp.id] = { nome: emp.nome, semanas: {} };
      snapSemanas.forEach(s => {
        const snapVal = snapLancs.find(l => l.semana_id === s.id);
        const liveVal = liveLancs.find(l => l.semana_id === s.id);
        result[emp.id].semanas[s.id] = {
          rotulo: s.rotulo || `S${s.numero}`,
          despAntiga: (snapVal?.despesa_consolidada || 0) + (snapVal?.despesa_prevista || 0) + (snapVal?.despesa_afac || 0) + (snapVal?.despesa_r21 || 0),
          despNova: (liveVal?.despesa_consolidada || 0) + (liveVal?.despesa_prevista || 0) + (liveVal?.despesa_afac || 0) + (liveVal?.despesa_r21 || 0),
          recAntiga: (snapVal?.receita_consolidada || 0) + (snapVal?.receita_prevista || 0),
          recNova: (liveVal?.receita_consolidada || 0) + (liveVal?.receita_prevista || 0),
        };
      });
    });
    return result;
  }, [comparando, versao, snapEmps, snapLancamentos, snapSemanas, lancamentosLive]);

  if (!versao) {
    return (
      <div className="flex flex-col items-center py-20">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Archived banner */}
      <div className="bg-[#4A4A4A] text-white rounded-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5" />
          <div>
            <p className="font-heading font-bold text-[16px]">
              Versão arquivada em {versao.data_referencia} — somente leitura
            </p>
            <p className="text-[13px] text-white/70">
              Arquivo criado em {new Date(versao.created_date).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant={comparando ? "default" : "outline"}
            size="sm"
            className={comparando ? "bg-white text-black hover:bg-white/90" : "border-white/30 text-white hover:bg-white/10"}
            onClick={() => setComparando(!comparando)}
          >
            {comparando ? 'Ocultar comparação' : 'Comparar com versão atual'}
          </Button>
          <Link to="/historico">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
      </div>

      {/* Comparison table */}
      {comparando && comparacao && (
        <Card className="border-2 border-[#4A4A4A]">
          <CardHeader className="pb-3 px-6 pt-6">
            <CardTitle className="text-[18px] font-heading font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#AD0000]" />
              Comparação: Versão Arquivada → Versão Atual
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 overflow-x-auto">
            {Object.values(comparacao).map(emp => (
              <div key={emp.nome} className="mb-6 last:mb-0">
                <h3 className="font-heading font-bold text-[16px] mb-3">{emp.nome}</h3>
                <table className="w-full text-[14px] min-w-[500px]">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 px-3">Semana</th>
                      <th className="text-right py-2 px-3">Desp. Antiga</th>
                      <th className="text-right py-2 px-3">Desp. Nova</th>
                      <th className="text-right py-2 px-3">Variação</th>
                      <th className="text-right py-2 px-3">Rec. Antiga</th>
                      <th className="text-right py-2 px-3">Rec. Nova</th>
                      <th className="text-right py-2 px-3">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(emp.semanas).map(s => {
                      const varDesp = s.despNova - s.despAntiga;
                      const varRec = s.recNova - s.recAntiga;
                      return (
                        <tr key={s.rotulo} className="border-b border-border">
                          <td className="py-2 px-3 font-medium">{s.rotulo}</td>
                          <td className="text-right py-2 px-3 tabular-nums">{formatBRL(s.despAntiga)}</td>
                          <td className="text-right py-2 px-3 tabular-nums">{formatBRL(s.despNova)}</td>
                          <td className={`text-right py-2 px-3 tabular-nums font-medium ${varDesp > 0 ? 'text-[#AD0000]' : varDesp < 0 ? 'text-green-600' : ''}`}>
                            {varDesp > 0 ? '+' : ''}{formatBRL(varDesp)}
                          </td>
                          <td className="text-right py-2 px-3 tabular-nums">{formatBRL(s.recAntiga)}</td>
                          <td className="text-right py-2 px-3 tabular-nums">{formatBRL(s.recNova)}</td>
                          <td className={`text-right py-2 px-3 tabular-nums font-medium ${varRec > 0 ? 'text-green-600' : varRec < 0 ? 'text-[#AD0000]' : ''}`}>
                            {varRec > 0 ? '+' : ''}{formatBRL(varRec)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Render each empreendimento from snapshot */}
      {snapEmps.filter(e => e.ativo !== false).map(emp => {
        const empLancs = snapLancamentos.filter(l => l.empreendimento_id === emp.id);
        const saldoEmp = snapSaldos.find(s => s.empreendimento_id === emp.id);
        const projetos = emp.tipo_fluxo === 'multi_projetos'
          ? snapProjetos.filter(p => p.empreendimento_pai_id === emp.id)
          : [];

        const despPorSemana = {};
        if (emp.tipo_fluxo === 'multi_projetos') {
          const projetoIds = projetos.map(p => p.id);
          snapSemanas.forEach(s => {
            despPorSemana[s.id] = snapDespesas
              .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
              .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
          });
        }

        const acumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, snapSemanas, despPorSemana, projetos);
        const contasAPagar = calcContasAPagar(empLancs, snapSemanas, despPorSemana);

        let saldoAtual = saldoEmp?.saldo_atual || 0;
        if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
          saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
        }

        const aporteNecessario = (emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos')
          ? calcAporteTotalNecessario(contasAPagar, saldoAtual, emp.margem_aporte_total || 0)
          : 0;

        return (
          <div key={emp.id} className="space-y-8">
            <div className="flex items-center gap-3">
              <h2 className="text-[24px] font-heading font-bold">{emp.nome}</h2>
              <span className="text-[14px] text-muted-foreground capitalize">{emp.tipo_fluxo?.replace('_', ' ')}</span>
            </div>

            <ReadOnlyIndicadores emp={emp} saldoEmp={saldoEmp} contasAPagar={contasAPagar} aporteNecessario={aporteNecessario} />

            {emp.tipo_fluxo === 'multi_projetos' ? (
              <div className="opacity-80 pointer-events-none">
                <TabelaMultiProjetos
                  emp={emp}
                  semanas={snapSemanas}
                  projetos={projetos}
                  despesasProjetos={snapDespesas}
                  acumulados={acumulados}
                />
              </div>
            ) : (
              <div className="opacity-80 pointer-events-none">
                <TabelaSemanas
                  emp={emp}
                  semanas={snapSemanas}
                  lancamentos={empLancs}
                  saldoEmp={saldoEmp}
                  acumulados={acumulados}
                />
              </div>
            )}

            <div className="opacity-80 pointer-events-none">
              <AportesSection
                emp={emp}
                semanas={snapSemanas}
                lancamentos={snapLancamentos}
                saldoEmp={saldoEmp}
                participacoes={snapParticipacoes}
                socios={snapSocios}
                despesasPorSemana={despPorSemana}
                projetosInternos={projetos}
                acumulados={acumulados}
              />
            </div>

            <hr className="border-border" />
          </div>
        );
      })}
    </div>
  );
}

function ReadOnlyIndicadores({ emp, saldoEmp, contasAPagar, aporteNecessario }) {
  return (
    <Card>
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-[18px] font-heading font-medium">Indicadores</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Saldo Atual</p>
            <p className="text-[20px] font-semibold tabular-nums">{formatBRL(saldoEmp?.saldo_atual || 0)}</p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Saldo Aplicado</p>
            <p className="text-[20px] font-semibold tabular-nums">{formatBRL(saldoEmp?.saldo_aplicado || 0)}</p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Contas a Pagar</p>
            <p className="text-[20px] font-semibold tabular-nums">{formatBRL(contasAPagar)}</p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Aporte Necessário</p>
            <p className={`text-[20px] font-semibold tabular-nums ${aporteNecessario > 0 ? 'text-[#AD0000]' : ''}`}>
              {formatBRL(aporteNecessario)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}