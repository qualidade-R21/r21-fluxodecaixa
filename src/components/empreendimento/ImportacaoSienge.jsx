import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, X, AlertTriangle, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatBRL } from '@/lib/calculos';
import { useQueryClient } from '@tanstack/react-query';

function parseValor(str) {
  if (!str) return null;
  const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const v = parseFloat(cleaned);
  return isNaN(v) ? null : v;
}

function parseSiengeText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  let tipo = null;
  let nomeEmpresa = null;
  let totalEmpresa = null;
  const porData = {};

  const reEmpresa = /empresa\s*\d+\s*[-–]\s*(.+)/i;
  const reTotalDia = /total\s+do\s+dia/i;
  const reTotalEmpresa = /total\s+da\s+empresa/i;
  const reData = /^\d{2}\/\d{2}\/\d{4}$/;

  let dataAtual = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/contas\s+a\s+pagar/i.test(line)) tipo = 'despesas';
    else if (/contas\s+a\s+receber/i.test(line)) tipo = 'receitas';

    const mEmp = line.match(reEmpresa);
    if (mEmp) nomeEmpresa = mEmp[1].trim();

    if (reData.test(line)) {
      dataAtual = line;
    }

    if (reTotalEmpresa.test(line)) {
      // find last numeric token in this line or next few lines
      const nums = line.match(/[\d.,]+/g) || [];
      const next = lines[i + 1] || '';
      const numsNext = next.match(/[\d.,]+/g) || [];
      const allNums = [...nums, ...numsNext];
      for (let j = allNums.length - 1; j >= 0; j--) {
        const v = parseValor(allNums[j]);
        if (v !== null && v > 0) { totalEmpresa = v; break; }
      }
    }

    if (reTotalDia.test(line) && dataAtual) {
      // Extract last numeric value in this line
      const nums = line.match(/[\d.,]+/g) || [];
      // also check next line
      let valorDia = null;
      for (let j = nums.length - 1; j >= 0; j--) {
        const v = parseValor(nums[j]);
        if (v !== null && v > 0) { valorDia = v; break; }
      }
      if (valorDia === null) {
        const nextLine = lines[i + 1] || '';
        const nextNums = nextLine.match(/[\d.,]+/g) || [];
        for (let j = nextNums.length - 1; j >= 0; j--) {
          const v = parseValor(nextNums[j]);
          if (v !== null && v > 0) { valorDia = v; break; }
        }
      }
      if (valorDia !== null) {
        porData[dataAtual] = (porData[dataAtual] || 0) + valorDia;
      }
    }
  }

  return { tipo, nomeEmpresa, totalEmpresa, porData };
}

function agruparPorSemana(porData, semanas) {
  const porSemana = {};
  semanas.forEach(s => { porSemana[s.id] = 0; });

  Object.entries(porData).forEach(([dataStr, valor]) => {
    const [d, m, a] = dataStr.split('/').map(Number);
    const data = new Date(a, m - 1, d);
    const semana = semanas.find(s => {
      const ini = new Date(s.data_inicio);
      const fim = new Date(s.data_fim);
      // normalize to date only
      ini.setHours(0,0,0,0); fim.setHours(23,59,59,999); data.setHours(12,0,0,0);
      return data >= ini && data <= fim;
    });
    if (semana) {
      porSemana[semana.id] = (porSemana[semana.id] || 0) + valor;
    }
  });

  return porSemana;
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
      // Upload to get url, then extract
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const ext = file.name.split('.').pop().toLowerCase();
      const isCsv = ext === 'csv';
      
      // Use LLM to extract data from the document
      const prompt = `Você é um extrator de dados de relatórios financeiros do sistema Sienge.
Analise o documento e extraia:
1. O tipo do relatório: "despesas" se título for "Contas a Pagar", "receitas" se for "Contas a Receber"
2. O nome da empresa no cabeçalho (padrão: "Empresa N - Nome..." ou "EmpresaN - Nome...")
3. Para cada data de vencimento, o valor do "Total do dia" (último valor numérico nessa linha)
4. O "Total da empresa" geral do relatório
5. Somar valores de datas repetidas (podem ocorrer em quebras de página)

Retorne JSON com:
{
  "tipo": "despesas" ou "receitas",
  "nome_empresa": "string",
  "total_empresa": number,
  "por_data": { "DD/MM/YYYY": number, ... }
}`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            tipo: { type: 'string' },
            nome_empresa: { type: 'string' },
            total_empresa: { type: 'number' },
            por_data: { type: 'object' }
          }
        }
      });

      const { tipo, nome_empresa, total_empresa, por_data } = result;

      if (!tipo || !por_data) {
        setError('Não foi possível identificar o tipo do relatório ou extrair os dados. Verifique se é um relatório Sienge válido.');
        setLoading(false);
        return;
      }

      const porSemana = agruparPorSemana(por_data || {}, semanas);
      const totalExtraido = Object.values(porSemana).reduce((s, v) => s + v, 0);

      setPreview({
        tipo,
        nomeEmpresa: nome_empresa,
        totalEmpresa: total_empresa,
        totalExtraido,
        porSemana,
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
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">{preview.fileNome}</span>
              <Badge variant={preview.tipo === 'despesas' ? 'destructive' : 'default'}>
                {preview.tipo === 'despesas' ? 'Despesas' : 'Receitas'}
              </Badge>
              {preview.nomeEmpresa && (
                <span className="text-xs text-muted-foreground">• {preview.nomeEmpresa}</span>
              )}
            </div>
            <button onClick={() => setPreview(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>

          {diffTotal !== null && diffTotal > 1 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              <AlertTriangle className="w-3 h-3" />
              Diferença de {formatBRL(diffTotal)} em relação ao "Total da Empresa" ({formatBRL(preview.totalEmpresa)}) do relatório.
            </div>
          )}

          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 text-muted-foreground">Semana</th>
                <th className="text-right py-1.5 px-2 text-muted-foreground">Extraído</th>
                <th className="text-right py-1.5 px-2 text-muted-foreground">Atual</th>
                <th className="text-right py-1.5 px-2 text-muted-foreground">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {semanas.map(s => {
                const extraido = preview.porSemana[s.id] || 0;
                const atual = getLancAtual(s.id, fieldAtual);
                const d = extraido - atual;
                return (
                  <tr key={s.id} className="border-b border-border/40">
                    <td className="py-1.5 px-2 font-medium">{getSemanaLabel(s.id)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{formatBRL(extraido)}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">{formatBRL(atual)}</td>
                    <td className={`text-right py-1.5 px-2 tabular-nums font-medium ${d !== 0 ? (d > 0 ? 'text-green-600' : 'text-primary') : 'text-muted-foreground'}`}>
                      {d !== 0 ? (d > 0 ? '+' : '') + formatBRL(d) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-foreground">
                <td className="py-1.5 px-2 font-bold">TOTAL</td>
                <td className="text-right py-1.5 px-2 tabular-nums font-bold">{formatBRL(preview.totalExtraido)}</td>
                <td className="text-right py-1.5 px-2 tabular-nums font-bold text-muted-foreground">{formatBRL(totalAtual)}</td>
                <td className={`text-right py-1.5 px-2 tabular-nums font-bold ${diff !== 0 ? (diff > 0 ? 'text-green-600' : 'text-primary') : 'text-muted-foreground'}`}>
                  {diff !== 0 ? (diff > 0 ? '+' : '') + formatBRL(diff) : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleConfirm} disabled={loading}>
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
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Processando relatório...
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Upload className="w-4 h-4" />
            <span>Arrastar ou clicar para importar relatório Sienge (PDF ou Excel)</span>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-primary mt-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </div>
      )}
    </div>
  );
}