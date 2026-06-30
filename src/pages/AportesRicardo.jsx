import React, { useMemo, useState, useEffect } from 'react';
import { useEmpreendimentos, useCicloAtivo, useSemanas, useLancamentos, useSaldos, useSocios, useParticipacoes, useProjetosInternos, useDespesasProjetos, useAporteOverridesRicardo, useSalvarAporteOverridesRicardo } from '@/lib/useFluxoData';
import { calcEqualizacao, calcFatorRateio, calcAportesPorSemana, calcSaldosAcumulados, formatBRL, calcContasAPagar, calcAporteTotalNecessario } from '@/lib/calculos';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';

function EditableCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const handleFocus = () => {
    setEditing(true);
    setRaw(value ? String(value) : '');
  };

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
    if (num !== (value || 0)) onCommit(num);
  };

  return editing ? (
    <Input
      type="text"
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={handleBlur}
      autoFocus
      className="h-8 text-[15px] w-28 text-right"
    />
  ) : (
    <span
      onClick={handleFocus}
      className="cursor-pointer hover:bg-muted px-1.5 py-0.5 rounded text-[15px] tabular-nums"
    >
      {formatBRL(value || 0)}
    </span>
  );
}

export default function AportesRicardo() {
  const { data: empreendimentos } = useEmpreendimentos();
  const { data: cicloAtivo } = useCicloAtivo();
  const { data: semanas } = useSemanas(cicloAtivo?.id);
  const semanaIds = useMemo(() => semanas.map(s => s.id), [semanas]);
  const { data: lancamentos } = useLancamentos(cicloAtivo?.id, semanaIds);
  const { data: saldos } = useSaldos(cicloAtivo?.id);
  const { data: socios } = useSocios();
  const { data: participacoes } = useParticipacoes();

  const gcEmp = empreendimentos.find(e => e.tipo_fluxo === 'multi_projetos');
  const { data: projetos } = useProjetosInternos(gcEmp?.id);
  const { data: despesasProjetos } = useDespesasProjetos(semanaIds);
  const { data: overridesSalvos } = useAporteOverridesRicardo(cicloAtivo?.id);
  const salvarMutation = useSalvarAporteOverridesRicardo();

  const semanasOrdenadas = useMemo(() =>
    [...semanas].sort((a, b) => a.numero - b.numero), [semanas]
  );

  const getAportes = (empNome) => {
    const emp = empreendimentos.find(e => e.nome.includes(empNome));
    if (!emp) return {};
    const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
    const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);

    let despPorSemana = {};
    let projs = [];
    if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
      projs = projetos;
      const projetoIds = projetos.map(p => p.id);
      semanasOrdenadas.forEach(s => {
        despPorSemana[s.id] = despesasProjetos
          .filter(d => projetoIds.includes(d.projeto_id) && d.semana_id === s.id)
          .reduce((sum, d) => sum + (d.valor_despesa || 0), 0);
      });
    }

    const contasAPagar = calcContasAPagar(empLancs, semanasOrdenadas, emp, despPorSemana, 4);

    let saldoAtual = saldoEmp?.saldo_atual || 0;
    if (emp.tipo_fluxo === 'multi_projetos' && projs.length > 0) {
      saldoAtual = projs.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
    }

    const aporteTotal = calcAporteTotalNecessario(contasAPagar, saldoAtual, emp.margem_aporte_total || 0);
    const eq = calcEqualizacao(empParts, aporteTotal, emp, socios);
    const eqF = calcFatorRateio(eq, aporteTotal);
    const acumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, semanasOrdenadas, despPorSemana, projs);
    return calcAportesPorSemana(empLancs, emp, saldoEmp, semanasOrdenadas, eqF, despPorSemana, projs, acumulados);
  };

  const socioGTR = socios.find(s => s.nome === 'GTR');
  const socioRicardo = socios.find(s => s.nome === 'Ricardo');
  const socioRIC = socios.find(s => s.nome === 'RIC');

  // CORRIGIDO: socios adicionado nas dependências dos três useMemo
  const aportesPontaDoLobo = useMemo(() => getAportes('Ponta do Lobo'), [empreendimentos, lancamentos, saldos, participacoes, semanasOrdenadas, socios]);
  const aportesSolenne = useMemo(() => getAportes('Solenne'), [empreendimentos, lancamentos, saldos, participacoes, semanasOrdenadas, socios]);
  const aportesGrupoGC = useMemo(() => getAportes('Green Concept'), [empreendimentos, lancamentos, saldos, participacoes, semanasOrdenadas, socios, projetos, despesasProjetos]);

  const rows = [
    {
      label: 'Solenne (GTR)',
      getData: (semanaId) => aportesSolenne[semanaId]?.porSocio[socioGTR?.id] || 0,
    },
    {
      label: 'Ponta do Lobo (Ricardo)',
      getData: (semanaId) => aportesPontaDoLobo[semanaId]?.porSocio[socioRicardo?.id] || 0,
    },
    {
      label: 'Green Concept (RIC)',
      getData: (semanaId) => aportesGrupoGC[semanaId]?.porSocio[socioRIC?.id] || 0,
    },
  ];

  const [overrides, setOverrides] = useState({});
  const cellKey = (rowLabel, semanaId) => `${rowLabel}__${semanaId}`;

  useEffect(() => {
    if (!overridesSalvos) return;
    const map = {};
    overridesSalvos.forEach(r => {
      map[`${r.row_label}__${r.semana_id}`] = r.valor;
    });
    setOverrides(map);
  }, [overridesSalvos]);

  const getDisplayValue = (row, semanaId) => {
    const key = cellKey(row.label, semanaId);
    return key in overrides ? overrides[key] : row.getData(semanaId);
  };

  const hasUnsavedChanges = (() => {
    if (!overridesSalvos) return Object.keys(overrides).length > 0;
    const savedMap = {};
    overridesSalvos.forEach(r => { savedMap[`${r.row_label}__${r.semana_id}`] = r.valor; });
    const allKeys = new Set([...Object.keys(overrides), ...Object.keys(savedMap)]);
    for (const k of allKeys) {
      if ((overrides[k] || 0) !== (savedMap[k] || 0)) return true;
    }
    return false;
  })();

  const handleSalvar = () => {
    const payload = Object.entries(overrides).map(([key, valor]) => {
      const [rowLabel, semanaId] = key.split('__');
      return { row_label: rowLabel, semana_id: semanaId, valor };
    });
    salvarMutation.mutate({ cicloId: cicloAtivo?.id, overrides: payload });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-heading font-bold">Aportes Ricardo</h1>
        <p className="text-[14px] text-muted-foreground mt-1">Consolidação dos aportes vinculados ao Ricardo</p>
      </div>

      <Card>
        <CardHeader className="pb-3 px-6 pt-6">
          <CardTitle className="text-[20px] font-heading font-medium">Aportes por Semana</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-6 pb-6">
          <table className="w-full text-[15px] min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Origem</th>
                {semanasOrdenadas.map(s => (
                  <th key={s.id} className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">
                    {s.rotulo || `Sem ${s.numero}`}
                  </th>
                ))}
                <th className="text-right py-3 px-3 font-heading text-[13px] uppercase tracking-wide text-[#4A4A4A]">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                let total = 0;
                return (
                  <tr key={row.label} className={`border-b border-[#E5E5E5] ${ri % 2 === 0 ? 'bg-[#FAFAFA]' : ''}`} style={{ height: '44px' }}>
                    <td className="py-3 px-3 font-medium">{row.label}</td>
                    {semanasOrdenadas.map(s => {
                      const val = getDisplayValue(row, s.id);
                      total += val;
                      return (
                        <td key={s.id} className={`text-right py-3 px-3 tabular-nums ${val > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          <EditableCell
                            value={val}
                            onCommit={(v) => setOverrides(prev => ({ ...prev, [cellKey(row.label, s.id)]: v }))}
                          />
                        </td>
                      );
                    })}
                    <td className="text-right py-3 px-3 tabular-nums font-semibold">{formatBRL(total)}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#F0F0F0] border-t-2 border-foreground">
                <td className="py-3 px-3 font-semibold">TOTAL</td>
                {semanasOrdenadas.map(s => {
                  const total = rows.reduce((sum, r) => sum + getDisplayValue(r, s.id), 0);
                  return (
                    <td key={s.id} className="text-right py-3 px-3 tabular-nums font-semibold">{formatBRL(total)}</td>
                  );
                })}
                <td className="text-right py-3 px-3 tabular-nums font-semibold">
                  {formatBRL(semanasOrdenadas.reduce((sum, s) => sum + rows.reduce((rs, r) => rs + getDisplayValue(r, s.id), 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {hasUnsavedChanges && (
        <div className="flex justify-end">
          <Button onClick={handleSalvar} disabled={salvarMutation.isPending}>
            {salvarMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="h-4 w-4" /> Salvar Alterações</>
            )}
          </Button>
        </div>
      )}
      </div>
      );
      }