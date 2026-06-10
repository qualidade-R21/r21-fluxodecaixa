import jsPDF from 'jspdf';
import {
  formatBRL,
  calcSaldoSemana,
  calcSaldosAcumulados,
  calcContasAPagar,
  calcAporteTotalNecessario,
  calcEqualizacao,
  calcFatorRateio,
  calcAportesPorSemana,
} from '@/lib/calculos';

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const R21_RED = [173, 0, 0];
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
const GRAY_LIGHT = [245, 245, 245];
const GRAY_MED = [200, 200, 200];
const GRAY_DARK = [100, 100, 100];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function now() {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function ptToPx(pt) { return pt; } // jsPDF usa pt internamente

function setFont(doc, bold = false, size = 9) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
}

function rgb(doc, color) {
  doc.setTextColor(...color);
}

function fillRgb(doc, color) {
  doc.setFillColor(...color);
}

function drawRgb(doc, color) {
  doc.setDrawColor(...color);
}

// ─────────────────────────────────────────────
// CABEÇALHO DE PÁGINA
// ─────────────────────────────────────────────
function drawHeader(doc, titulo, subtitulo, geradoEm) {
  const pw = doc.internal.pageSize.getWidth();
  // Faixa preta
  fillRgb(doc, BLACK);
  doc.rect(0, 0, pw, 22, 'F');

  // Bloco vermelho (logo R21)
  fillRgb(doc, R21_RED);
  doc.rect(8, 3, 22, 16, 'F');
  setFont(doc, true, 12);
  rgb(doc, WHITE);
  doc.text('R21', 19, 14, { align: 'center' });

  // Título
  setFont(doc, true, 11);
  rgb(doc, WHITE);
  doc.text(titulo, 36, 10);

  // Subtítulo
  setFont(doc, false, 8);
  rgb(doc, [200, 200, 200]);
  doc.text(subtitulo, 36, 17);

  // Data/hora de geração
  setFont(doc, false, 7);
  rgb(doc, [180, 180, 180]);
  doc.text(`Gerado em ${geradoEm}`, pw - 8, 14, { align: 'right' });
}

// ─────────────────────────────────────────────
// RODAPÉ DE PÁGINA
// ─────────────────────────────────────────────
function drawFooter(doc, geradoEm) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const total = doc.internal.getNumberOfPages();

  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawRgb(doc, GRAY_MED);
    doc.setLineWidth(0.3);
    doc.line(8, ph - 10, pw - 8, ph - 10);
    setFont(doc, false, 7);
    rgb(doc, GRAY_DARK);
    doc.text('R21 Empreendimentos · Fluxo de Caixa Semanal', 8, ph - 5);
    doc.text(`${geradoEm}  |  Pág. ${i} / ${total}`, pw - 8, ph - 5, { align: 'right' });
  }
}

// ─────────────────────────────────────────────
// BLOCO DE INDICADORES
// ─────────────────────────────────────────────
function drawIndicadores(doc, y, emp, saldoEmp, contasAPagar, aporteNecessario) {
  const pw = doc.internal.pageSize.getWidth();
  setFont(doc, true, 9);
  rgb(doc, BLACK);
  doc.text('Indicadores do Ciclo', 8, y);
  y += 5;

  const items = [];
  items.push({ label: 'Saldo Atual', value: saldoEmp?.saldo_atual || 0 });
  if (emp.tem_saldo_aplicado) items.push({ label: 'Saldo Aplicado', value: saldoEmp?.saldo_aplicado || 0 });
  if (emp.despesa_dividida_r21) items.push({ label: 'Saldo Atual R21', value: saldoEmp?.saldo_atual_r21 || 0 });
  if (emp.tem_saldo_decoracao) items.push({ label: 'Saldo Decoração', value: saldoEmp?.saldo_decoracao || 0 });
  if (emp.tem_inadimplencia) items.push({ label: 'Inadimplência', value: saldoEmp?.inadimplencia || 0 });
  items.push({ label: 'Contas a Pagar (Mês)', value: contasAPagar });
  if (emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos') {
    items.push({ label: 'Aporte Total Necessário', value: aporteNecessario, highlight: aporteNecessario > 0 });
  }

  const colW = (pw - 16) / Math.min(items.length, 4);
  const boxH = 14;

  let col = 0;
  let row = 0;
  items.forEach((item, idx) => {
    col = idx % 4;
    row = Math.floor(idx / 4);
    const x = 8 + col * colW;
    const yy = y + row * (boxH + 2);

    fillRgb(doc, GRAY_LIGHT);
    drawRgb(doc, GRAY_MED);
    doc.setLineWidth(0.2);
    doc.rect(x, yy, colW - 2, boxH, 'FD');

    setFont(doc, false, 6.5);
    rgb(doc, GRAY_DARK);
    doc.text(item.label.toUpperCase(), x + 2, yy + 4.5);

    setFont(doc, true, 8.5);
    rgb(doc, item.highlight ? R21_RED : (item.value < 0 ? R21_RED : BLACK));
    doc.text(formatBRL(item.value), x + colW - 4, yy + 10.5, { align: 'right' });
  });

  const rowsUsed = Math.ceil(items.length / 4);
  return y + rowsUsed * (boxH + 2) + 4;
}

// ─────────────────────────────────────────────
// TABELA GENÉRICA
// ─────────────────────────────────────────────
function drawTable(doc, y, headers, rows, colWidths, opts = {}) {
  const { zebra = true, boldLastRow = false } = opts;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ROW_H = 7;
  const HEADER_H = 8;
  const x0 = 8;

  // Verifica espaço
  if (y + HEADER_H + ROW_H > ph - 14) {
    doc.addPage();
    y = 28;
  }

  // Cabeçalho
  fillRgb(doc, BLACK);
  doc.rect(x0, y, pw - 16, HEADER_H, 'F');
  setFont(doc, true, 7);
  rgb(doc, WHITE);
  let cx = x0;
  headers.forEach((h, i) => {
    const align = i === 0 ? 'left' : 'right';
    const tx = align === 'left' ? cx + 2 : cx + colWidths[i] - 2;
    doc.text(String(h), tx, y + 5.5, { align });
    cx += colWidths[i];
  });

  y += HEADER_H;

  rows.forEach((row, ri) => {
    if (y + ROW_H > ph - 14) {
      doc.addPage();
      y = 28;
      // Repete cabeçalho
      fillRgb(doc, BLACK);
      doc.rect(x0, y, pw - 16, HEADER_H, 'F');
      setFont(doc, true, 7);
      rgb(doc, WHITE);
      let cx2 = x0;
      headers.forEach((h, i) => {
        const align = i === 0 ? 'left' : 'right';
        const tx = align === 'left' ? cx2 + 2 : cx2 + colWidths[i] - 2;
        doc.text(String(h), tx, y + 5.5, { align });
        cx2 += colWidths[i];
      });
      y += HEADER_H;
    }

    const isLast = ri === rows.length - 1 && boldLastRow;
    if (zebra && ri % 2 === 0) {
      fillRgb(doc, GRAY_LIGHT);
      doc.rect(x0, y, pw - 16, ROW_H, 'F');
    }
    if (isLast) {
      fillRgb(doc, [230, 230, 230]);
      doc.rect(x0, y, pw - 16, ROW_H, 'F');
    }

    drawRgb(doc, GRAY_MED);
    doc.setLineWidth(0.1);
    doc.line(x0, y + ROW_H, x0 + (pw - 16), y + ROW_H);

    setFont(doc, isLast, 7);

    let cx3 = x0;
    row.forEach((cell, ci) => {
      const align = ci === 0 ? 'left' : 'right';
      const tx = align === 'left' ? cx3 + 2 : cx3 + colWidths[ci] - 2;
      const isNeg = typeof cell === 'number' && cell < 0;
      const isHighlight = typeof cell === 'object' && cell?.highlight;
      const displayVal = typeof cell === 'number' ? formatBRL(cell) : (typeof cell === 'object' ? String(cell?.value ?? '') : String(cell ?? ''));
      rgb(doc, isNeg || isHighlight ? R21_RED : BLACK);
      doc.text(displayVal, tx, y + 5, { align });
      cx3 += colWidths[ci];
    });

    y += ROW_H;
  });

  return y + 4;
}

// ─────────────────────────────────────────────
// GRÁFICO DE LINHA (saldo acumulado)
// ─────────────────────────────────────────────
function drawLineChart(doc, y, semanas, acumuladosPorEmp, empreendimentos) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const CHART_H = 45;
  const CHART_W = pw - 16;
  const x0 = 8;

  if (y + CHART_H + 10 > ph - 14) {
    doc.addPage();
    y = 28;
  }

  setFont(doc, true, 8);
  rgb(doc, BLACK);
  doc.text('Saldo Acumulado — Evolução Semanal', x0, y);
  y += 5;

  // Coleta todos os valores para calcular escala
  const allVals = [];
  empreendimentos.forEach(emp => {
    semanas.forEach(s => {
      const v = acumuladosPorEmp[emp.id]?.[s.id];
      if (v !== undefined) allVals.push(v);
    });
  });

  if (allVals.length === 0) return y + 6;

  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 0);
  const range = maxVal - minVal || 1;

  // Área do gráfico
  const gX = x0 + 18;
  const gY = y;
  const gW = CHART_W - 20;
  const gH = CHART_H;

  fillRgb(doc, [252, 252, 252]);
  drawRgb(doc, GRAY_MED);
  doc.setLineWidth(0.2);
  doc.rect(gX, gY, gW, gH, 'FD');

  // Linha zero
  if (minVal < 0 && maxVal > 0) {
    const zeroY = gY + gH - ((0 - minVal) / range) * gH;
    drawRgb(doc, [220, 60, 60]);
    doc.setLineWidth(0.3);
    doc.setLineDash([2, 2], 0);
    doc.line(gX, zeroY, gX + gW, zeroY);
    doc.setLineDash([], 0);
  }

  // Grades horizontais
  drawRgb(doc, [220, 220, 220]);
  doc.setLineWidth(0.1);
  for (let g = 0; g <= 4; g++) {
    const gy = gY + (g / 4) * gH;
    doc.line(gX, gy, gX + gW, gy);
    const label = formatBRL(maxVal - (g / 4) * range);
    setFont(doc, false, 5.5);
    rgb(doc, GRAY_DARK);
    doc.text(label, gX - 2, gy + 1.5, { align: 'right' });
  }

  // Eixo X – rótulos de semana
  semanas.forEach((s, si) => {
    const sx = gX + (si / Math.max(semanas.length - 1, 1)) * gW;
    setFont(doc, false, 5.5);
    rgb(doc, GRAY_DARK);
    doc.text(s.rotulo || `S${s.numero}`, sx, gY + gH + 4, { align: 'center' });
  });

  // Paleta de cores para linhas
  const colors = [
    R21_RED,
    [37, 99, 235],
    [22, 163, 74],
    [234, 88, 12],
    [124, 58, 237],
    [6, 182, 212],
    [180, 83, 9],
    [219, 39, 119],
  ];

  const legendItems = [];

  empreendimentos.forEach((emp, ei) => {
    const color = colors[ei % colors.length];
    const pts = semanas.map((s, si) => {
      const v = acumuladosPorEmp[emp.id]?.[s.id] || 0;
      return {
        x: gX + (si / Math.max(semanas.length - 1, 1)) * gW,
        y: gY + gH - ((v - minVal) / range) * gH
      };
    });

    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    for (let pi = 0; pi < pts.length - 1; pi++) {
      doc.line(pts[pi].x, pts[pi].y, pts[pi + 1].x, pts[pi + 1].y);
    }

    // Pontos
    pts.forEach(pt => {
      fillRgb(doc, color);
      doc.circle(pt.x, pt.y, 1, 'F');
    });

    legendItems.push({ nome: emp.nome, color });
  });

  y += gH + 8;

  // Legenda
  let lx = x0;
  legendItems.forEach(item => {
    fillRgb(doc, item.color);
    doc.rect(lx, y, 5, 3, 'F');
    setFont(doc, false, 6.5);
    rgb(doc, BLACK);
    doc.text(item.nome, lx + 7, y + 2.5);
    lx += Math.min(item.nome.length * 3.5 + 12, 60);
    if (lx > pw - 20) {
      lx = x0;
      y += 6;
    }
  });

  return y + 8;
}

// ─────────────────────────────────────────────
// SEÇÃO DE UM EMPREENDIMENTO
// ─────────────────────────────────────────────
function drawEmpSection(doc, y, { emp, saldoEmp, semanas, lancamentos, projetos, despesasProjetos, acumulados,
  contasAPagar, aporteNecessario, participacoes, socios, cicloAtivo }) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Título do empreendimento
  if (y + 12 > ph - 14) { doc.addPage(); y = 28; }
  fillRgb(doc, R21_RED);
  doc.rect(8, y, pw - 16, 10, 'F');
  setFont(doc, true, 10);
  rgb(doc, WHITE);
  doc.text(emp.nome, 12, y + 7);
  y += 14;

  // ── Indicadores
  y = drawIndicadores(doc, y, emp, saldoEmp, contasAPagar, aporteNecessario);

  // ── Fluxo Semanal
  if (y + 10 > ph - 14) { doc.addPage(); y = 28; }
  setFont(doc, true, 9);
  rgb(doc, BLACK);
  doc.text('Fluxo Semanal', 8, y);
  y += 4;

  if (emp.tipo_fluxo === 'multi_projetos') {
    // Tabela multi projetos
    const projHeaders = ['Semana', ...projetos.map(p => p.nome), 'Total', 'Saldo Acum.'];
    const totalW = pw - 16;
    const firstW = 24;
    const lastW = 22;
    const otherW = (totalW - firstW - lastW * 2) / Math.max(projetos.length, 1);
    const projColWidths = [firstW, ...projetos.map(() => otherW), lastW, lastW];

    const projRows = semanas.map(s => {
      const total = projetos.reduce((sum, p) => {
        const d = despesasProjetos.find(d => d.projeto_id === p.id && d.semana_id === s.id);
        return sum + (d?.valor_despesa || 0);
      }, 0);
      const acum = acumulados[s.id] || 0;
      return [
        s.rotulo || `S${s.numero}`,
        ...projetos.map(p => {
          const d = despesasProjetos.find(d => d.projeto_id === p.id && d.semana_id === s.id);
          return d?.valor_despesa || 0;
        }),
        total,
        acum
      ];
    });
    y = drawTable(doc, y, projHeaders, projRows, projColWidths, { boldLastRow: false });
  } else {
    // Tabela padrão
    const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const cols = [];
    if (emp.despesa_dividida_r21) {
      cols.push({ key: 'despesa_consolidada', label: 'Despesa GTR' });
      cols.push({ key: 'despesa_r21', label: 'Despesa R21' });
      cols.push({ key: 'despesa_afac', label: 'Prev. Afac' });
    } else {
      cols.push({ key: 'despesa_consolidada', label: 'Desp. Cons.' });
      cols.push({ key: 'despesa_prevista', label: 'Desp. Prev.' });
      if (emp.tipo_fluxo === 'com_aportes') {
        cols.push({ key: 'despesa_afac', label: 'Prev. Afac' });
      }
    }
    if (emp.tem_receita !== false) {
      cols.push({ key: 'receita_consolidada', label: 'Rec. Cons.' });
      cols.push({ key: 'receita_prevista', label: 'Rec. Prev.' });
    }
    cols.push({ key: '__saldo_semana__', label: 'Saldo Sem.' });
    cols.push({ key: '__saldo_acum__', label: 'Saldo Acum.' });

    const totalW = pw - 16;
    const firstW = 24;
    const restW = (totalW - firstW) / cols.length;
    const colWidths = [firstW, ...cols.map(() => restW)];

    const tableRows = semanas.map(s => {
      const lanc = empLancs.find(l => l.semana_id === s.id) || {};
      const saldoSem = calcSaldoSemana(lanc, emp);
      const saldoAcum = acumulados[s.id] || 0;
      return [
        s.rotulo || `S${s.numero}`,
        ...cols.map(c => {
          if (c.key === '__saldo_semana__') return saldoSem;
          if (c.key === '__saldo_acum__') return saldoAcum;
          return lanc[c.key] || 0;
        })
      ];
    });

    y = drawTable(doc, y, ['Semana', ...cols.map(c => c.label)], tableRows, colWidths);
  }

  // ── Aportes (se aplicável)
  const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
  if ((emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos') && empParts.length > 0) {
    if (y + 10 > ph - 14) { doc.addPage(); y = 28; }
    setFont(doc, true, 9);
    rgb(doc, BLACK);
    doc.text('Resumo Valores Aportados (Equalização)', 8, y);
    y += 4;

    const equalizacao = calcEqualizacao(empParts, aporteNecessario);
    const eqComFator = calcFatorRateio(equalizacao);

    const eqHeaders = ['Sócio', '% Soc.', 'Aportado', 'Devolvido', 'Saldo Dev.', '% Atual', 'Total p/ Eq.', 'Aporte Nec.', 'Fator'];
    const totalW = pw - 16;
    const eqWidths = [28, 14, 24, 22, 22, 14, 24, 24, 14];
    const eqRows = eqComFator.map(e => [
      socios.find(s => s.id === e.socio_id)?.nome || '—',
      `${(e.percentual_sociedade || 0).toFixed(2)}%`,
      e.valor_aportado || 0,
      e.valor_devolvido || 0,
      e.saldoADevolver || 0,
      `${((e.percentualAtual || 0) * 100).toFixed(2)}%`,
      e.totalParaEqualizar || 0,
      e.aporteNecessario < 0 ? { value: formatBRL(e.aporteNecessario), highlight: true } : e.aporteNecessario,
      `${((e.fatorRateio || 0) * 100).toFixed(2)}%`,
    ]);
    y = drawTable(doc, y, eqHeaders, eqRows, eqWidths);

    // Aportes por semana
    if (y + 10 > ph - 14) { doc.addPage(); y = 28; }
    setFont(doc, true, 9);
    rgb(doc, BLACK);
    doc.text('Aportes por Semana', 8, y);
    y += 4;

    const empLancsForAporte = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const despPorSemana = {};
    if (emp.tipo_fluxo === 'multi_projetos') {
      semanas.forEach(s => {
        despPorSemana[s.id] = projetos.reduce((sum, p) => {
          const d = despesasProjetos.find(dd => dd.projeto_id === p.id && dd.semana_id === s.id);
          return sum + (d?.valor_despesa || 0);
        }, 0);
      });
    }
    const aportesSemana = calcAportesPorSemana(empLancsForAporte, emp, saldoEmp, semanas, eqComFator, despPorSemana, projetos);

    const asHeaders = ['Sócio', ...semanas.map(s => s.rotulo || `S${s.numero}`), 'Total'];
    const asW = (pw - 16 - 30) / (semanas.length + 1);
    const asWidths = [30, ...semanas.map(() => asW), asW];

    const asRows = [];
    eqComFator.forEach(e => {
      let totalSocio = 0;
      const row = [socios.find(s => s.id === e.socio_id)?.nome || '—'];
      semanas.forEach(s => {
        const val = aportesSemana[s.id]?.porSocio[e.socio_id] || 0;
        totalSocio += val;
        row.push(val);
      });
      row.push(totalSocio);
      asRows.push(row);
    });
    // Linha total
    const totalRow = ['TOTAL'];
    let grandTotal = 0;
    semanas.forEach(s => {
      const t = aportesSemana[s.id]?.total || 0;
      grandTotal += t;
      totalRow.push(t);
    });
    totalRow.push(grandTotal);
    asRows.push(totalRow);
    y = drawTable(doc, y, asHeaders, asRows, asWidths, { boldLastRow: true });
  }

  // ── Gráfico de linha (só para este empreendimento)
  y = drawLineChart(doc, y, semanas, { [emp.id]: acumulados }, [emp]);

  // ── Observações
  const obs = saldoEmp?.observacoes;
  if (obs) {
    if (y + 12 > ph - 14) { doc.addPage(); y = 28; }
    setFont(doc, true, 8);
    rgb(doc, BLACK);
    doc.text('Observações:', 8, y);
    y += 4;
    setFont(doc, false, 7.5);
    rgb(doc, GRAY_DARK);
    const lines = doc.splitTextToSize(obs, pw - 16);
    lines.forEach(line => {
      if (y + 5 > ph - 14) { doc.addPage(); y = 28; }
      doc.text(line, 8, y);
      y += 4.5;
    });
    y += 2;
  }

  return y;
}

// ─────────────────────────────────────────────
// SUBTÍTULO DO CICLO
// ─────────────────────────────────────────────
function buildSubtitulo(cicloAtivo, semanas) {
  if (!cicloAtivo) return '';
  const s0 = semanas[0];
  const sN = semanas[semanas.length - 1];
  const range = s0 && sN ? ` · ${s0.data_inicio ? new Date(s0.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : s0.rotulo} a ${sN.data_fim ? new Date(sN.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : sN.rotulo}` : '';
  return `${cicloAtivo.nome}${range}`;
}

// ─────────────────────────────────────────────
// EXPORT: PDF POR EMPREENDIMENTO
// ─────────────────────────────────────────────
export function gerarPDFEmpreendimento({
  emp, saldoEmp, semanas, lancamentos, projetos, despesasProjetos,
  acumulados, contasAPagar, aporteNecessario, participacoes, socios, cicloAtivo
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const geradoEm = now();
  const subtitulo = buildSubtitulo(cicloAtivo, semanas);

  drawHeader(doc, `Fluxo de Caixa Semanal — ${emp.nome}`, subtitulo, geradoEm);
  let y = 28;

  y = drawEmpSection(doc, y, {
    emp, saldoEmp, semanas, lancamentos, projetos, despesasProjetos,
    acumulados, contasAPagar, aporteNecessario, participacoes, socios, cicloAtivo
  });

  drawFooter(doc, geradoEm);

  const nomeCiclo = cicloAtivo?.nome?.replace(/[\s/]/g, '_') || 'Ciclo';
  doc.save(`Fluxo de Caixa - ${emp.nome} - ${nomeCiclo}.pdf`);
}

// ─────────────────────────────────────────────
// EXPORT: PDF GERAL CONSOLIDADO
// ─────────────────────────────────────────────
export function gerarPDFGeral({
  empreendimentos, saldos, semanas, lancamentos, allProjetos, despesasProjetos,
  participacoes, socios, cicloAtivo, empData
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const geradoEm = now();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const subtitulo = buildSubtitulo(cicloAtivo, semanas);

  // ── PÁGINA 1: Resumo Executivo ──────────────────────────────
  drawHeader(doc, 'Fluxo de Caixa Semanal — Relatório Geral', subtitulo, geradoEm);
  let y = 28;

  // Tabela resumo
  setFont(doc, true, 9);
  rgb(doc, BLACK);
  doc.text('Resumo por Empreendimento', 8, y);
  y += 4;

  const resumoHeaders = ['Empreendimento', 'Saldo Inicial', 'Saldo Final (S6)', 'Contas a Pagar', 'Aporte Nec.'];
  const totalW = pw - 16;
  const resumoWidths = [80, 42, 42, 42, 42];
  // preenche o restante na primeira col
  resumoWidths[0] = totalW - resumoWidths.slice(1).reduce((a, b) => a + b, 0);

  const resumoRows = empreendimentos.map(emp => {
    const d = empData[emp.id] || {};
    const temNeg = d.temSaldoNegativo;
    return [
      temNeg ? { value: emp.nome, highlight: true } : emp.nome,
      d.saldoAtual || 0,
      d.saldoAcumuladoFinal || 0,
      d.contasAPagar || 0,
      d.aporteNecessario > 0 ? { value: formatBRL(d.aporteNecessario), highlight: true } : (d.aporteNecessario || 0)
    ];
  });
  y = drawTable(doc, y, resumoHeaders, resumoRows, resumoWidths);

  // Gráfico comparativo
  const acumuladosPorEmp = {};
  empreendimentos.forEach(emp => { acumuladosPorEmp[emp.id] = empData[emp.id]?.acumulados || {}; });
  y = drawLineChart(doc, y, semanas, acumuladosPorEmp, empreendimentos);

  // Tabela Aportes Ricardo/GTR/RIC por semana
  // Empreendimentos com aportes
  const empsComAportes = empreendimentos.filter(e => e.tipo_fluxo === 'com_aportes' || e.tipo_fluxo === 'multi_projetos');
  if (empsComAportes.length > 0) {
    if (y + 10 > ph - 14) { doc.addPage(); y = 28; }
    setFont(doc, true, 9);
    rgb(doc, BLACK);
    doc.text('Aportes Consolidados por Semana', 8, y);
    y += 4;

    const aportesHeaders = ['Empreendimento', ...semanas.map(s => s.rotulo || `S${s.numero}`), 'Total'];
    const aColW = (pw - 16 - 60) / (semanas.length + 1);
    const aColWidths = [60, ...semanas.map(() => aColW), aColW];

    const aRows = [];
    empsComAportes.forEach(emp => {
      const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
      const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
      const projetos = emp.tipo_fluxo === 'multi_projetos' ? allProjetos : [];
      const despPorSemana = {};
      if (emp.tipo_fluxo === 'multi_projetos') {
        semanas.forEach(s => {
          despPorSemana[s.id] = projetos.reduce((sum, p) => {
            const d = despesasProjetos.find(dd => dd.projeto_id === p.id && dd.semana_id === s.id);
            return sum + (d?.valor_despesa || 0);
          }, 0);
        });
      }
      const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
      if (empParts.length === 0) return;

      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
        saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }
      const contasAPagar = calcContasAPagar(empLancs, semanas, despPorSemana);
      const aporteTotal = contasAPagar > saldoAtual ? contasAPagar - saldoAtual + (emp.margem_aporte_total || 0) : 0;
      const equalizacao = calcEqualizacao(empParts, aporteTotal);
      const eqComFator = calcFatorRateio(equalizacao);
      const aportesSemana = calcAportesPorSemana(empLancs, emp, saldoEmp, semanas, eqComFator, despPorSemana, projetos);

      let grandTotal = 0;
      const row = [emp.nome];
      semanas.forEach(s => {
        const t = aportesSemana[s.id]?.total || 0;
        grandTotal += t;
        row.push(t);
      });
      row.push(grandTotal);
      aRows.push(row);
    });

    if (aRows.length > 0) {
      // Linha total consolidado
      const totalConsolRow = ['TOTAL GERAL'];
      let grandGrand = 0;
      semanas.forEach((s, si) => {
        const t = aRows.reduce((sum, r) => sum + (r[si + 1] || 0), 0);
        grandGrand += t;
        totalConsolRow.push(t);
      });
      totalConsolRow.push(grandGrand);
      aRows.push(totalConsolRow);
      y = drawTable(doc, y, aportesHeaders, aRows, aColWidths, { boldLastRow: true });
    }
  }

  // ── PÁGINAS SEGUINTES: uma por empreendimento ──────────────
  empreendimentos.forEach(emp => {
    doc.addPage();
    drawHeader(doc, `Fluxo de Caixa Semanal — ${emp.nome}`, subtitulo, geradoEm);
    let ey = 28;

    const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
    const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const projetos = emp.tipo_fluxo === 'multi_projetos' ? allProjetos : [];
    const d = empData[emp.id] || {};

    drawEmpSection(doc, ey, {
      emp,
      saldoEmp,
      semanas,
      lancamentos,
      projetos,
      despesasProjetos,
      acumulados: d.acumulados || {},
      contasAPagar: d.contasAPagar || 0,
      aporteNecessario: d.aporteNecessario || 0,
      participacoes,
      socios,
      cicloAtivo
    });
  });

  drawFooter(doc, geradoEm);

  const nomeCiclo = cicloAtivo?.nome?.replace(/[\s/]/g, '_') || 'Ciclo';
  doc.save(`Fluxo de Caixa - Geral - ${nomeCiclo}.pdf`);
}