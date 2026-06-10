import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, X, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatBRL } from '@/lib/calculos';
import { useQueryClient } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// PASSO 1: Reconstruir linhas de texto respeitando a rotação da página
async function pdfLines(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    // CRÍTICO: converter as coordenadas pelo viewport — isso corrige a rotação
    const pts = tc.items.map(it => {
      const t = pdfjsLib.Util.transform(vp.transform, it.transform);
      return { s: it.str, x: t[4], y: t[5] };
    });
    pts.sort((a, b) => a.y - b.y || a.x - b.x);
    let row = [], ly = null;
    pts.forEach(pt => {
      if (ly === null || Math.abs(pt.y - ly) <= 2.5) { row.push(pt); if (ly === null) ly = pt.y; }
      else {
        lines.push(row.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim());
        row = [pt]; ly = pt.y;
      }
    });
    if (row.length) lines.push(row.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim());
  }
  return lines;
}

// PASSO 2: Extrair totais diários e agrupar por semana do ciclo
function parseSienge(lines, semanasDoCiclo) {
  const brnum = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
  const txt = lines.join('\n');
  const tipo = /contas a pagar/i.test(txt) ? 'despesas'
             : /contas a receber/i.test(txt) ? 'receitas' : null;

  // No relatório de despesas a data vem do cabeçalho "Data de vencimento";
  // no de receitas, cada lançamento começa com a própria data.
  const anchor = /Data de vencimento/.test(txt);
  let cur = null;
  const daily = {};
  let totalEmpresa = null;
  let nomeEmpresa = null;

  lines.forEach(l => {
    // Captura nome da empresa
    const mEmp = l.match(/empresa\s*\d+\s*[-–]\s*(.+)/i);
    if (mEmp) nomeEmpresa = mEmp[1].trim();

    // Captura total da empresa (último número da linha)
    if (/total\s+da\s+empresa/i.test(l)) {
      const ns = l.match(/[\d.]*\d,\d{2}/g);
      if (ns) totalEmpresa = brnum(ns[ns.length - 1]);
    }

    // Data de vencimento (despesas)
    let m = l.match(/Data de vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) { cur = m[1]; return; }

    // Data inline (receitas)
    if (!anchor) {
      m = l.match(/^(\d{2}\/\d{2}\/\d{4})\s(?!-\s*\d{2}:)/); // ignora rodapé com hora
      if (m) cur = m[1];
    }

    // Total do dia — último número = coluna Total líquida
    if (/^Total do dia/i.test(l) && cur) {
      const ns = l.match(/[\d.]*\d,\d{2}/g);
      if (ns) daily[cur] = (daily[cur] || 0) + brnum(ns[ns.length - 1]);
    }
  });

  // Agrupar cada data na semana do ciclo
  const sem = semanasDoCiclo.map(() => 0);
  let fora = 0;
  Object.keys(daily).forEach(k => {
    const [d, mo, y] = k.split('/').map(Number);
    const dt = new Date(y, mo - 1, d);
    let hit = false;
    semanasDoCiclo.forEach((w, i) => {
      if (dt >= w.inicio && dt <= w.fim) { sem[i] += daily[k]; hit = true; }
    });
    if (!hit) fora += daily[k];
  });

  return { tipo, nomeEmpresa, totalEmpresa, sem, fora };
}

export default function ImportacaoSienge({ emp, semanas, lancamentos, cicloId, onImported }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // { tipo, nomeEmpresa, totalEmpresa, porSemana, fileNome }
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef();
  const qc = useQueryClient();

  const handleFile = async (file) => {
    setError(null);
    setSuccess(false);
    setPreview(null);
    setLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Monta estrutura de semanas para o parser (objetos Date para comparação)
      const semanasDoCiclo = semanas.map(s => ({
        id: s.id,
        inicio: new Date(s.data_inicio + 'T00:00:00'),
        fim: new Date(s.data_fim + 'T23:59:59'),
      }));

      const lines = await pdfLines(arrayBuffer);
      const { tipo, nomeEmpresa, totalEmpresa, sem, fora } = parseSienge(lines, semanasDoCiclo);

      if (!tipo) {
        setError('Não foi possível identificar o tipo do relatório. Verifique se é um relatório Sienge de Contas a Pagar ou Contas a Receber.');
        setLoading(false);
        return;
      }

      // Montar porSemana por id
      const porSemana = {};
      semanas.forEach((s, i) => { porSemana[s.id] = sem[i] || 0; });
      const totalExtraido = sem.reduce((a, b) => a + b, 0) + fora;

      setPreview({
        tipo,
        nomeEmpresa,
        totalEmpresa,
        totalExtraido,
        porSemana,
        fora,
        fileNome: file.name
      });
    } catch (e) {
      setError('Erro ao processar arquivo: ' + e.message);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLoading(true);
    const field = preview.tipo === 'despesas'
      ? (emp.despesa_dividida_r21 ? 'despesa_consolidada' : 'despesa_consolidada')
      : 'receita_consolidada';

    for (const semana of semanas) {
      const val = preview.porSemana[semana.id] || 0;
      if (val === 0) continue;
      const lanc = lancamentos.find(l => l.semana_id === semana.id && l.empreendimento_id === emp.id);
      if (lanc) {
        await base44.entities.LancamentoSemanal.update(lanc.id, { [field]: val });
      } else {
        await base44.entities.LancamentoSemanal.create({
          empreendimento_id: emp.id,
          semana_id: semana.id,
          [field]: val
        });
      }
    }

    // Registro de importação
    await base44.entities.RegistroImportacao.create({
      empreendimento_id: emp.id,
      ciclo_id: cicloId,
      nome_arquivo: preview.fileNome,
      tipo: preview.tipo,
      total_extraido: preview.totalExtraido,
    });

    qc.invalidateQueries({ queryKey: ['lancamentos'] });
    setSuccess(true);
    setPreview(null);
    setLoading(false);
    if (onImported) onImported();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const getSemanaLabel = (semanaId) => {
    const s = semanas.find(s => s.id === semanaId);
    return s ? (s.rotulo || `Sem ${s.numero}`) : semanaId;
  };

  const getLancAtual = (semanaId, field) => {
    const lanc = lancamentos.find(l => l.semana_id === semanaId && l.empreendimento_id === emp.id);
    return lanc?.[field] || 0;
  };

  if (success) {
    return (
      <div className="flex items-center gap-2 text-[15px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <CheckCircle className="w-4 h-4" />
        Importação realizada com sucesso!
        <button onClick={() => setSuccess(false)} className="ml-auto text-green-400 hover:text-green-600"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (preview) {
    const fieldAtual = preview.tipo === 'despesas' ? 'despesa_consolidada' : 'receita_consolidada';
    const totalAtual = semanas.reduce((sum, s) => sum + getLancAtual(s.id, fieldAtual), 0);
    const diff = preview.totalExtraido - totalAtual;
    const diffTotal = preview.totalEmpresa ? Math.abs(preview.totalExtraido - preview.totalEmpresa) : null;

    return (
      <Card className="border-2 border-primary/30">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-[15px]">{preview.fileNome}</span>
              <Badge variant={preview.tipo === 'despesas' ? 'destructive' : 'default'}>
                {preview.tipo === 'despesas' ? 'Despesas' : 'Receitas'}
              </Badge>
              {preview.nomeEmpresa && (
                <span className="text-[13px] text-muted-foreground">• {preview.nomeEmpresa}</span>
              )}
            </div>
            <button onClick={() => setPreview(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>

          {preview.fora > 0 && (
            <div className="flex items-center gap-2 text-[13px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              {formatBRL(preview.fora)} fora do período das semanas do ciclo.
            </div>
          )}
          {diffTotal !== null && diffTotal > 1 && (
            <div className="flex items-center gap-2 text-[13px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              Diferença de {formatBRL(diffTotal)} em relação ao "Total da Empresa" ({formatBRL(preview.totalEmpresa)}) do relatório.
            </div>
          )}

          <table className="w-full text-[15px] mb-5">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 text-[13px] uppercase tracking-wide text-[#4A4A4A] font-medium">Semana</th>
                <th className="text-right py-3 px-3 text-[13px] uppercase tracking-wide text-[#4A4A4A] font-medium">Extraído</th>
                <th className="text-right py-3 px-3 text-[13px] uppercase tracking-wide text-[#4A4A4A] font-medium">Atual</th>
                <th className="text-right py-3 px-3 text-[13px] uppercase tracking-wide text-[#4A4A4A] font-medium">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((s, si) => {
                const extraido = preview.porSemana[s.id] || 0;
                const atual = getLancAtual(s.id, fieldAtual);
                const d = extraido - atual;
                return (
                  <tr key={s.id} className={`border-b border-[#E5E5E5] ${si % 2 === 0 ? 'bg-[#FAFAFA]' : ''}`} style={{ height: '44px' }}>
                    <td className="py-2 px-3 font-medium">{getSemanaLabel(s.id)}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{formatBRL(extraido)}</td>
                    <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">{formatBRL(atual)}</td>
                    <td className={`text-right py-2 px-3 tabular-nums font-medium ${d !== 0 ? (d > 0 ? 'text-green-600' : 'text-primary') : 'text-muted-foreground'}`}>
                      {d !== 0 ? (d > 0 ? '+' : '') + formatBRL(d) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#F0F0F0] border-t-2 border-foreground">
                <td className="py-2 px-3 font-semibold">TOTAL</td>
                <td className="text-right py-2 px-3 tabular-nums font-semibold">{formatBRL(preview.totalExtraido)}</td>
                <td className="text-right py-2 px-3 tabular-nums font-semibold text-muted-foreground">{formatBRL(totalAtual)}</td>
                <td className={`text-right py-2 px-3 tabular-nums font-semibold ${diff !== 0 ? (diff > 0 ? 'text-green-600' : 'text-primary') : 'text-muted-foreground'}`}>
                  {diff !== 0 ? (diff > 0 ? '+' : '') + formatBRL(diff) : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" className="text-[15px]" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button className="text-[15px]" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Gravando...' : 'Confirmar Importação'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg px-6 py-4 text-center transition-colors cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          className="hidden"
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-[15px] text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Processando relatório...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[15px] text-muted-foreground">
            <Upload className="w-4 h-4" />
            <span>Arrastar ou clicar para importar relatório Sienge (PDF ou Excel)</span>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-[13px] text-primary mt-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
    </div>
  );
}