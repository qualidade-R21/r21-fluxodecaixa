import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, X, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatBRL } from '@/lib/calculos';
import { useQueryClient } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

async function pdfLines(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
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

function parseSienge(lines, semanasDoCiclo) {
  const brnum = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
  const txt = lines.join('\n');
  const mPeriodo = txt.match(/Per[ií]odo\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  const periodoInicio = mPeriodo ? mPeriodo[1] : null;
  const tipo = /contas a pagar/i.test(txt) ? 'despesas'
             : /contas a receber/i.test(txt) ? 'receitas' : null;

  const anchor = /Data de vencimento/.test(txt);
  let cur = null;
  const daily = {};
  let totalEmpresa = null;
  let nomeEmpresa = null;

  lines.forEach(l => {
    const mEmp = l.match(/empresa\s*\d+\s*[-\u2013]\s*(.+)/i);
    if (mEmp) nomeEmpresa = mEmp[1].trim();

    if (/total\s+da\s+empresa/i.test(l)) {
      const ns = l.match(/[\d.]*\d,\d{2}/g);
      if (ns) totalEmpresa = brnum(ns[ns.length - 1]);
    }

    let m = l.match(/Data de vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/);
    if (m) { cur = m[1]; return; }

    if (!anchor) {
      m = l.match(/^(\d{2}\/\d{2}\/\d{4})\s(?!-\s*\d{2}:)/);
      if (m) cur = m[1];
    }

    if (/^Total do dia/i.test(l) && cur) {
      const ns = l.match(/[\d.]*\d,\d{2}/g);
      if (ns) daily[cur] = (daily[cur] || 0) + brnum(ns[ns.length - 1]);
    }
  });

  let effectiveSemanas = semanasDoCiclo;
  const sem = effectiveSemanas.map(() => 0);
  let fora = 0;
  Object.keys(daily).forEach(k => {
    const [d, mo, y] = k.split('/').map(Number);
    const dt = new Date(y, mo - 1, d);
    let hit = false;
    effectiveSemanas.forEach((w, i) => {
      if (dt >= new Date(w.inicio) && dt <= new Date(w.fim)) { sem[i] += daily[k]; hit = true; }
    });
    if (!hit) fora += daily[k];
  });

  return { tipo, nomeEmpresa, totalEmpresa, sem, fora };
}

export default function ImportacaoSienge({ emp, semanas, lancamentos, cicloId, onImported }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const inputRef = useRef();
  const qc = useQueryClient();

  const processFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const semanasDoCiclo = semanas.map(s => ({
      id: s.id,
      inicio: new Date(s.data_inicio + 'T00:00:00'),
      fim: new Date(s.data_fim + 'T23:59:59'),
    }));

    const lines = await pdfLines(arrayBuffer);
    const { tipo, nomeEmpresa, totalEmpresa, sem, fora } = parseSienge(lines, semanasDoCiclo);

    if (!tipo) return null;

    const porSemana = {};
    semanas.forEach((s, i) => { porSemana[s.id] = sem[i] || 0; });
    const totalExtraido = sem.reduce((a, b) => a + b, 0) + fora;

    return {
      tipo,
      nomeEmpresa,
      totalEmpresa,
      totalExtraido,
      porSemana,
      fora,
      fileNome: file.name,
      file
    };
  };

  const handleFiles = async (files) => {
    setError(null);
    setSuccess(null);
    setPreviews([]);
    setLoading(true);

    const results = [];
    for (const file of files) {
      const r = await processFile(file);
      if (r) results.push(r);
    }

    if (results.length === 0) {
      setError('Nenhum relatório Sienge válido encontrado. Verifique se são relatórios de Contas a Pagar ou Contas a Receber.');
    } else {
      setPreviews(results);
    }
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  };

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length) handleFiles(files);
  };

  const removePreview = (idx) => {
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const doConfirm = async () => {
    if (!previews.length) return;
    setLoading(true);
    setError(null);

    try {
      // Upload files and collect URLs
      const fileUrls = [];
      for (const p of previews) {
        if (p.file) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: p.file });
          fileUrls.push(file_url);
        } else {
          fileUrls.push(null);
        }
      }

      await base44.functions.invoke('importarSienge', {
        empreendimento_id: emp.id,
        ciclo_id: cicloId,
        previews,
        semanaIds: semanas.map(s => s.id),
        fileUrls
      });

      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['despesas-projetos'] });
      qc.invalidateQueries({ queryKey: ['projetos-internos'] });
      setSuccess(`${previews.length} relatório(s) importado(s)`);
      setPreviews([]);
      if (onImported) onImported();
    } catch (e) {
      setError(`Erro ao importar: ${e?.response?.data?.error || e.message || 'Erro desconhecido'}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
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
        {success}
        <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-600"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (previews.length > 0) {
    return (
      <div className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 text-[13px] text-primary bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
          </div>
        )}
        {previews.map((preview, idx) => {
          const fieldAtual = preview.tipo === 'despesas' ? 'despesa_consolidada' : 'receita_consolidada';
          const totalAtual = semanas.reduce((sum, s) => sum + getLancAtual(s.id, fieldAtual), 0);
          const diff = preview.totalExtraido - totalAtual;
          const diffTotal = preview.totalEmpresa ? Math.abs(preview.totalExtraido - preview.totalEmpresa) : null;

          return (
            <Card key={idx} className="border-2 border-primary/30">
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
                  <button onClick={() => removePreview(idx)}><X className="w-4 h-4 text-muted-foreground" /></button>
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
                    {semanas.filter(s => (preview.porSemana[s.id] || 0) > 0).map((s, si) => {
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
              </CardContent>
            </Card>
          );
        })}

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" className="text-[15px]" onClick={() => setPreviews([])}>Cancelar</Button>
          <Button className="text-[15px]" onClick={doConfirm} disabled={loading}>
            {loading ? 'Gravando...' : `Confirmar Importação${previews.length > 1 ? ` (${previews.length})` : ''}`}
          </Button>
        </div>

      </div>
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
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-[15px] text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Processando relatórios...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-[15px] text-muted-foreground">
            <Upload className="w-4 h-4" />
            <span>Arrastar ou clicar para importar relatórios Sienge (PDF ou Excel) — múltiplos arquivos</span>
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