import jsPDF from 'jspdf';
import {
  formatBRL,
  calcSaldoSemana,
  calcContasAPagar,
  calcAporteTotalNecessario,
  calcEqualizacao,
  calcFatorRateio,
  calcAportesPorSemana,
  calcSaldosAcumulados,
} from '@/lib/calculos';

// ── A4 landscape em mm: 297 × 210 ──────────────────────────
const PW = 297;   // page width
const PH = 210;   // page height
const ML = 8;     // margin left/right
const CW = PW - ML * 2; // content width = 281
const HEADER_H = 18;
const FOOTER_H = 8;
const BODY_TOP = HEADER_H + 4;
const BODY_BOT = PH - FOOTER_H - 2;

const R21_RED = [173, 0, 0];
const GREEN = [22, 163, 74];
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];
const GRAY_LIGHT = [247, 247, 247];
const GRAY_MED = [210, 210, 210];
const GRAY_DARK = [110, 110, 110];

function nowStr() {
  return new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function sf(doc, bold, size) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
}

// ── CABEÇALHO ────────────────────────────────────────────────
function drawHeader(doc, titulo, subtitulo, geradoEm) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PW, HEADER_H, 'F');

  // Bloco vermelho R21
  doc.setFillColor(...R21_RED);
  doc.rect(ML, 2, 16, 14, 'F');
  sf(doc, true, 9);
  doc.setTextColor(...WHITE);
  doc.text('R21', ML + 8, 10.5, { align: 'center' });

  // Título
  sf(doc, true, 10);
  doc.setTextColor(...WHITE);
  doc.text(titulo, ML + 20, 8.5);

  // Subtítulo
  sf(doc, false, 7);
  doc.setTextColor(200, 200, 200);
  doc.text(subtitulo, ML + 20, 14.5);

  // Data geração
  sf(doc, false, 6.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em ${geradoEm}`, PW - ML, 11, { align: 'right' });
}

// ── RODAPÉ (aplicado ao final em todas as páginas) ───────────
function drawFooter(doc, geradoEm) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRAY_MED);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - FOOTER_H, PW - ML, PH - FOOTER_H);
    sf(doc, false, 6);
    doc.setTextColor(...GRAY_DARK);
    doc.text('R21 Empreendimentos · Fluxo de Caixa Semanal', ML, PH - 3);
    doc.text(`${geradoEm}  |  Pág. ${i} / ${total}`, PW - ML, PH - 3, { align: 'right' });
  }
}

// ── VERIFICAÇÃO DE QUEBRA DE PÁGINA ──────────────────────────
function ensureSpace(doc, y, needed) {
  if (y + needed > BODY_BOT) {
    doc.addPage();
    drawHeader(doc, doc.__titulo, doc.__subtitulo, doc.__geradoEm);
    return BODY_TOP;
  }
  return y;
}

// ── SEÇÃO TÍTULO ─────────────────────────────────────────────
function drawSectionTitle(doc, y, text) {
  y = ensureSpace(doc, y, 10);
  sf(doc, true, 8.5);
  doc.setTextColor(...BLACK);
  doc.text(text, ML, y + 3);
  return y + 7;
}

// ── BLOCO DE INDICADORES ─────────────────────────────────────
function drawIndicadores(doc, y, emp, saldoEmp, contasAPagar, aporteNecessario, projetos = [], semanas = [], numSemanasContas = 4) {
  const items = [];
  let saldoAtual = saldoEmp?.saldo_atual || 0;
  if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
    saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
  }
  items.push({ label: 'Saldo Atual', value: saldoAtual });
  if (emp.tem_saldo_aplicado) items.push({ label: 'Saldo Aplicado', value: saldoEmp?.saldo_aplicado || 0 });
  if (emp.despesa_dividida_r21) items.push({ label: 'Saldo Atual R21', value: saldoEmp?.saldo_atual_r21 || 0 });
  if (emp.tem_saldo_decoracao) items.push({ label: 'Saldo Decoração', value: saldoEmp?.saldo_decoracao || 0 });
  if (emp.tem_inadimplencia) items.push({ label: 'Inadimplência', value: saldoEmp?.inadimplencia || 0 });
  const capIdx = Math.min(numSemanasContas, semanas.length) - 1;
  const capSemana = capIdx >= 0 ? semanas[capIdx] : null;
  let capLabel = 'Contas a Pagar (Mês)';
  if (capSemana?.data_fim) {
    const [yy, mm, dd] = capSemana.data_fim.split('-');
    capLabel = `Contas a Pagar até ${dd}/${mm}`;
  }
  items.push({ label: capLabel, value: contasAPagar });
  if (emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos') {
    items.push({ label: 'Aporte Total Necessário', value: aporteNecessario, highlight: aporteNecessario > 0 });
  }

  const COLS = Math.min(items.length, 5);
  const BOX_W = CW / COLS;
  const BOX_H = 12;

  y = ensureSpace(doc, y, BOX_H * Math.ceil(items.length / COLS) + 4);

  items.forEach((item, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = ML + col * BOX_W;
    const yy = y + row * (BOX_H + 1);

    doc.setFillColor(...GRAY_LIGHT);
    doc.setDrawColor(...GRAY_MED);
    doc.setLineWidth(0.15);
    doc.rect(x, yy, BOX_W - 1, BOX_H, 'FD');

    sf(doc, false, 5.5);
    doc.setTextColor(...GRAY_DARK);
    doc.text(item.label.toUpperCase(), x + 1.5, yy + 4);

    sf(doc, true, 8);
    const isNeg = item.value < 0;
    doc.setTextColor(...(item.highlight || isNeg ? R21_RED : BLACK));
    doc.text(formatBRL(item.value), x + BOX_W - 2.5, yy + 9.5, { align: 'right' });
  });

  const rowsUsed = Math.ceil(items.length / COLS);
  return y + rowsUsed * (BOX_H + 1) + 4;
}

// ── TABELA GENÉRICA ──────────────────────────────────────────
// colWidths: array de larguras em mm (deve somar CW)
// cells: cada valor pode ser: number | string | { value: string, red: boolean }
function drawTable(doc, y, headers, rows, colWidths, opts = {}) {
  const { boldLastRow = false } = opts;
  const ROW_H = 6;
  const HEAD_H = 7;

  const repeatHeader = () => {
    doc.setFillColor(...BLACK);
    doc.rect(ML, y, CW, HEAD_H, 'F');
    sf(doc, true, 6.5);
    doc.setTextColor(...WHITE);
    let cx = ML;
    headers.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      const tx = align === 'left' ? cx + 1.5 : cx + colWidths[i] - 1.5;
      doc.text(String(h), tx, y + 4.8, { align });
      cx += colWidths[i];
    });
  };

  y = ensureSpace(doc, y, HEAD_H + ROW_H);
  repeatHeader();
  y += HEAD_H;

  rows.forEach((row, ri) => {
    y = ensureSpace(doc, y, ROW_H);
    if (y === BODY_TOP) { repeatHeader(); y += HEAD_H; }

    const isLast = ri === rows.length - 1 && boldLastRow;
    if (isLast) {
      doc.setFillColor(225, 225, 225);
      doc.rect(ML, y, CW, ROW_H, 'F');
    } else if (ri % 2 === 0) {
      doc.setFillColor(...GRAY_LIGHT);
      doc.rect(ML, y, CW, ROW_H, 'F');
    }

    doc.setDrawColor(...GRAY_MED);
    doc.setLineWidth(0.1);
    doc.line(ML, y + ROW_H, ML + CW, y + ROW_H);

    sf(doc, isLast, 6.5);
    let cx = ML;
    row.forEach((cell, ci) => {
      const align = ci === 0 ? 'left' : 'right';
      const tx = align === 'left' ? cx + 1.5 : cx + colWidths[ci] - 1.5;

      let display, color = BLACK;
      if (cell === null || cell === undefined) {
        display = '—';
      } else if (typeof cell === 'number') {
        display = formatBRL(cell);
        color = cell < 0 ? R21_RED : (cell > 0 ? GREEN : BLACK);
      } else if (typeof cell === 'object') {
        display = typeof cell.value === 'number' ? formatBRL(cell.value) : (cell.value ?? '—');
        color = cell.red ? R21_RED : (cell.green ? GREEN : BLACK);
      } else {
        display = String(cell);
      }

      doc.setTextColor(...color);
      doc.text(display, tx, y + 4.3, { align });
      cx += colWidths[ci];
    });

    y += ROW_H;
  });

  return y + 3;
}

// ── GRÁFICO DE LINHA ─────────────────────────────────────────
function drawLineChart(doc, y, semanas, acumuladosPorEmp, empreendimentos) {
  const CHART_H = 42;
  const LABEL_W = 22; // espaço para labels eixo Y
  const gX = ML + LABEL_W;
  const gW = CW - LABEL_W - 2;

  y = ensureSpace(doc, y, CHART_H + 16);

  sf(doc, true, 8);
  doc.setTextColor(...BLACK);
  doc.text('Saldo Acumulado — Evolução Semanal', ML, y + 3);
  y += 6;

  const gY = y;

  // Escala
  const allVals = [];
  empreendimentos.forEach(emp => {
    semanas.forEach(s => {
      const v = acumuladosPorEmp[emp.id]?.[s.id];
      if (typeof v === 'number' && !isNaN(v)) allVals.push(v);
    });
  });
  if (allVals.length === 0) return y + CHART_H + 10;

  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 0);
  const range = maxVal - minVal || 1;

  // Fundo
  doc.setFillColor(252, 252, 252);
  doc.setDrawColor(...GRAY_MED);
  doc.setLineWidth(0.15);
  doc.rect(gX, gY, gW, CHART_H, 'FD');

  // Grades e labels Y
  for (let g = 0; g <= 4; g++) {
    const gy = gY + (g / 4) * CHART_H;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(gX, gy, gX + gW, gy);
    const val = maxVal - (g / 4) * range;
    sf(doc, false, 5);
    doc.setTextColor(...GRAY_DARK);
    // Abreviação do valor para caber
    const absVal = Math.abs(val);
    let label;
    if (absVal >= 1000000) label = `${val < 0 ? '-' : ''}${(absVal / 1000000).toFixed(1)}M`;
    else if (absVal >= 1000) label = `${val < 0 ? '-' : ''}${(absVal / 1000).toFixed(0)}k`;
    else label = formatBRL(val);
    doc.text(label, gX - 1, gy + 1.5, { align: 'right' });
  }

  // Linha zero
  if (minVal < 0 && maxVal > 0) {
    const zeroY = gY + CHART_H - ((0 - minVal) / range) * CHART_H;
    doc.setDrawColor(...R21_RED);
    doc.setLineWidth(0.3);
    doc.setLineDash([1.5, 1.5], 0);
    doc.line(gX, zeroY, gX + gW, zeroY);
    doc.setLineDash([], 0);
  }

  // Labels eixo X
  semanas.forEach((s, si) => {
    const sx = gX + (si / Math.max(semanas.length - 1, 1)) * gW;
    sf(doc, false, 5);
    doc.setTextColor(...GRAY_DARK);
    const lbl = s.rotulo ? s.rotulo.substring(0, 11) : `S${s.numero}`;
    doc.text(lbl, sx, gY + CHART_H + 4, { align: 'center' });
  });

  // Paleta
  const palette = [R21_RED, [37, 99, 235], [22, 163, 74], [234, 88, 12], [124, 58, 237], [6, 182, 212], [180, 83, 9], [219, 39, 119]];
  const legendItems = [];

  empreendimentos.forEach((emp, ei) => {
    const color = palette[ei % palette.length];
    const pts = semanas.map((s, si) => {
      const val = acumuladosPorEmp[emp.id]?.[s.id] || 0;
      const yVal = gY + CHART_H - ((val - minVal) / range) * CHART_H;
      return {
        x: gX + (si / Math.max(semanas.length - 1, 1)) * gW,
        y: isNaN(yVal) ? gY + CHART_H : yVal
      };
    });

    doc.setDrawColor(...color);
    doc.setLineWidth(0.7);
    for (let pi = 0; pi < pts.length - 1; pi++) {
      if (!isNaN(pts[pi].x) && !isNaN(pts[pi].y) && !isNaN(pts[pi + 1].x) && !isNaN(pts[pi + 1].y)) {
        doc.line(pts[pi].x, pts[pi].y, pts[pi + 1].x, pts[pi + 1].y);
      }
    }
    pts.forEach(pt => {
      if (!isNaN(pt.x) && !isNaN(pt.y)) {
        doc.setFillColor(...color);
        doc.circle(pt.x, pt.y, 0.8, 'F');
      }
    });
    legendItems.push({ nome: emp.nome, color });
  });

  y += CHART_H + 7;

  // Legenda
  let lx = ML;
  legendItems.forEach((item, li) => {
    if (lx + 45 > PW - ML) { lx = ML; y += 5; }
    doc.setFillColor(...item.color);
    doc.rect(lx, y - 2, 4, 2.5, 'F');
    sf(doc, false, 6);
    doc.setTextColor(...BLACK);
    doc.text(item.nome, lx + 5.5, y);
    lx += Math.min(item.nome.length * 1.8 + 10, 50);
  });

  return y + 6;
}

// ── SEÇÃO COMPLETA DE UM EMPREENDIMENTO ──────────────────────
function drawEmpSection(doc, y, { emp, saldoEmp, semanas, lancamentos, projetos, despesasProjetos,
  acumulados, contasAPagar, aporteNecessario, participacoes, socios, numSemanasContas = 4 }) {

  // Barra título
  y = ensureSpace(doc, y, 12);
  doc.setFillColor(...R21_RED);
  doc.rect(ML, y, CW, 9, 'F');
  sf(doc, true, 9);
  doc.setTextColor(...WHITE);
  doc.text(emp.nome, ML + 2, y + 6.3);
  y += 12;

  // Indicadores
  y = drawIndicadores(doc, y, emp, saldoEmp, contasAPagar, aporteNecessario, projetos, semanas, numSemanasContas);

  // Fluxo Semanal
  y = drawSectionTitle(doc, y, 'Fluxo Semanal');

  if (emp.tipo_fluxo === 'multi_projetos') {
    const firstW = 22;
    const lastW = 20;
    const otherW = (CW - firstW - lastW * 2) / Math.max(projetos.length, 1);
    const heads = ['Semana', ...projetos.map(p => p.nome), 'Total', 'Saldo Acum.'];
    const widths = [firstW, ...projetos.map(() => otherW), lastW, lastW];
    const tRows = semanas.map(s => {
      const total = projetos.reduce((sum, p) => {
        const d = despesasProjetos.find(d => d.projeto_id === p.id && d.semana_id === s.id);
        return sum + (d?.valor_despesa || 0);
      }, 0);
      return [s.rotulo || `S${s.numero}`, ...projetos.map(p => {
        const d = despesasProjetos.find(d => d.projeto_id === p.id && d.semana_id === s.id);
        return { value: d?.valor_despesa || 0, red: true };
      }), { value: total, red: true }, acumulados[s.id] || 0];
    });
    y = drawTable(doc, y, heads, tRows, widths);
  } else {
    const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const cols = [];
    if (emp.despesa_dividida_r21) {
      cols.push({ key: 'despesa_consolidada', label: 'Desp. GTR' });
      cols.push({ key: 'despesa_r21', label: 'Desp. R21' });
      cols.push({ key: 'despesa_afac', label: 'Prev. Afac' });
    } else {
      cols.push({ key: 'despesa_consolidada', label: 'Desp. Cons.' });
      cols.push({ key: 'despesa_prevista', label: 'Desp. Prev.' });
      if (emp.tipo_fluxo === 'com_aportes') cols.push({ key: 'despesa_afac', label: 'Prev. Afac' });
    }
    if (emp.tem_receita !== false) {
      cols.push({ key: 'receita_consolidada', label: 'Rec. Cons.' });
      cols.push({ key: 'receita_prevista', label: 'Rec. Prev.' });
    }
    cols.push({ key: '_ss', label: 'Saldo Sem.' });
    cols.push({ key: '_sa', label: 'Saldo Acum.' });

    const firstW = 24;
    const colW = (CW - firstW) / cols.length;
    const widths = [firstW, ...cols.map(() => colW)];
    const heads = ['Semana', ...cols.map(c => c.label)];
    const tRows = semanas.map(s => {
      const lanc = empLancs.find(l => l.semana_id === s.id) || {};
      const ss = calcSaldoSemana(lanc, emp);
      const sa = acumulados[s.id] || 0;
      const expenseKeys = ['despesa_consolidada', 'despesa_r21', 'despesa_afac', 'despesa_prevista'];
      return [s.rotulo || `S${s.numero}`, ...cols.map(c => {
        if (c.key === '_ss') return ss;
        if (c.key === '_sa') return sa;
        const val = lanc[c.key] || 0;
        if (expenseKeys.includes(c.key)) return { value: val, red: true };
        return val;
      })];
    });
    y = drawTable(doc, y, heads, tRows, widths);
  }

  // Aportes
  const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
  if ((emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos') && empParts.length > 0) {
    const equalizacao = calcEqualizacao(empParts, aporteNecessario, emp, socios);
    const eqComFator = calcFatorRateio(equalizacao, aporteNecessario);


    y = drawSectionTitle(doc, y, 'Resumo Valores Aportados (Equalização)');
    const eqHeads = ['Sócio', '% Soc.', 'Aportado', 'Devolvido', 'Saldo Dev.', '% Atual', 'Total Eq.', 'Aporte Nec.'];
    const eqW = [28, 13, 28, 26, 26, 14, 28, 28];
    // ajusta para CW exato
    const eqSum = eqW.reduce((a, b) => a + b, 0);
    const eqScale = CW / eqSum;
    const eqWscaled = eqW.map(w => w * eqScale);

    const eqRows = eqComFator.map(e => [
      socios.find(s => s.id === e.socio_id)?.nome || '—',
      `${(e.percentual_sociedade || 0).toFixed(1)}%`,
      e.valor_aportado || 0,
      e.valor_devolvido || 0,
      e.saldoADevolver || 0,
      `${((e.percentualAtual || 0) * 100).toFixed(1)}%`,
      e.totalParaEqualizar || 0,
      e.aporteNecessario,
    ]);
    y = drawTable(doc, y, eqHeads, eqRows, eqWscaled);

    // Aportes por semana
    const empLancsA = lancamentos.filter(l => l.empreendimento_id === emp.id);
    const despPorSemana = {};
    if (emp.tipo_fluxo === 'multi_projetos') {
      semanas.forEach(s => {
        despPorSemana[s.id] = projetos.reduce((sum, p) => {
          const d = despesasProjetos.find(dd => dd.projeto_id === p.id && dd.semana_id === s.id);
          return sum + (d?.valor_despesa || 0);
        }, 0);
      });
    }
    const aportesSemana = calcAportesPorSemana(empLancsA, emp, saldoEmp, semanas, eqComFator, despPorSemana, projetos, acumulados);

    y = drawSectionTitle(doc, y, 'Aportes por Semana');
    const firstW = 30;
    const asColW = (CW - firstW) / (semanas.length + 1);
    const asHeads = ['Sócio', ...semanas.map(s => s.rotulo ? s.rotulo.substring(0, 11) : `S${s.numero}`), 'Total'];
    const asWidths = [firstW, ...semanas.map(() => asColW), asColW];
    const asRows = [];
    eqComFator.forEach(e => {
      let tot = 0;
      const row = [socios.find(s => s.id === e.socio_id)?.nome || '—'];
      semanas.forEach(s => { const v = aportesSemana[s.id]?.porSocio[e.socio_id] || 0; tot += v; row.push(v); });
      row.push(tot);
      asRows.push(row);
    });
    // total row
    const tRow = ['TOTAL'];
    let grand = 0;
    semanas.forEach(s => { const t = aportesSemana[s.id]?.total || 0; grand += t; tRow.push(t); });
    tRow.push(grand);
    asRows.push(tRow);
    y = drawTable(doc, y, asHeads, asRows, asWidths, { boldLastRow: true });
  }

  // Gráfico
  y = drawLineChart(doc, y, semanas, { [emp.id]: acumulados }, [emp]);

  // Observações
  const obs = saldoEmp?.observacoes;
  if (obs) {
    y = ensureSpace(doc, y, 14);
    sf(doc, true, 7.5);
    doc.setTextColor(...BLACK);
    doc.text('Observações:', ML, y + 3);
    y += 6;
    sf(doc, false, 7);
    doc.setTextColor(...GRAY_DARK);
    const lines = doc.splitTextToSize(obs, CW);
    lines.forEach(line => {
      y = ensureSpace(doc, y, 5);
      doc.text(line, ML, y + 3);
      y += 5;
    });
    y += 2;
  }

  return y;
}

// ── SUBTÍTULO DO CICLO ───────────────────────────────────────
function buildSubtitulo(cicloAtivo, semanas) {
  if (!cicloAtivo) return '';
  const s0 = semanas[0];
  const sN = semanas[semanas.length - 1];
  const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const range = s0 && sN ? ` · ${fmt(s0.data_inicio) || s0.rotulo} a ${fmt(sN.data_fim) || sN.rotulo}` : '';
  return `${cicloAtivo.nome}${range}`;
}

// ── EXPORT: PDF POR EMPREENDIMENTO ───────────────────────────
export function gerarPDFEmpreendimento({
  emp, saldoEmp, semanas, lancamentos, projetos, despesasProjetos,
  acumulados, contasAPagar, aporteNecessario, participacoes, socios, cicloAtivo, numSemanasContas = 4
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const geradoEm = nowStr();
  const subtitulo = buildSubtitulo(cicloAtivo, semanas);

  // Salva no doc para reutilizar em novas páginas
  doc.__titulo = `Fluxo de Caixa Semanal — ${emp.nome}`;
  doc.__subtitulo = subtitulo;
  doc.__geradoEm = geradoEm;

  drawHeader(doc, doc.__titulo, subtitulo, geradoEm);

  drawEmpSection(doc, BODY_TOP, {
    emp, saldoEmp, semanas, lancamentos, projetos: projetos || [],
    despesasProjetos: despesasProjetos || [], acumulados, contasAPagar,
    aporteNecessario, participacoes, socios, numSemanasContas
  });

  drawFooter(doc, geradoEm);

  const nomeCiclo = cicloAtivo?.nome?.replace(/[\s/]/g, '_') || 'Ciclo';
  const fileName = `Fluxo de Caixa - ${emp.nome} - ${nomeCiclo}.pdf`;
  const arrayBuffer = doc.output('arraybuffer');
  return { arrayBuffer, fileName };
}

// ── EXPORT: PDF GERAL ────────────────────────────────────────
export function gerarPDFGeral({
  empreendimentos, saldos, semanas, lancamentos, allProjetos, despesasProjetos,
  participacoes, socios, cicloAtivo, empData, numSemanasContas = 4
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  const geradoEm = nowStr();
  const subtitulo = buildSubtitulo(cicloAtivo, semanas);
  doc.__titulo = 'Fluxo de Caixa Semanal — Relatório Geral';
  doc.__subtitulo = subtitulo;
  doc.__geradoEm = geradoEm;

  drawHeader(doc, doc.__titulo, subtitulo, geradoEm);
  let y = BODY_TOP;

  // Resumo executivo
  y = drawSectionTitle(doc, y, 'Resumo por Empreendimento');
  const rHeads = ['Empreendimento', 'Saldo Inicial', 'Saldo Final (S6)', 'Contas a Pagar', 'Aporte Nec.'];
  const fixedW = 35;
  const firstW = CW - fixedW * (rHeads.length - 1);
  const rWidths = [firstW, fixedW, fixedW, fixedW, fixedW];
  const rRows = empreendimentos.map(emp => {
    const d = empData[emp.id] || {};
    return [
      d.temSaldoNegativo ? { value: emp.nome, red: true } : emp.nome,
      d.saldoAtual || 0,
      d.saldoAcumuladoFinal || 0,
      d.contasAPagar || 0,
      d.aporteNecessario > 0 ? { value: formatBRL(d.aporteNecessario), red: true } : (d.aporteNecessario || 0)
    ];
  });
  y = drawTable(doc, y, rHeads, rRows, rWidths);

  // Gráfico comparativo
  const acumuladosPorEmp = {};
  empreendimentos.forEach(emp => { acumuladosPorEmp[emp.id] = empData[emp.id]?.acumulados || {}; });
  y = drawLineChart(doc, y, semanas, acumuladosPorEmp, empreendimentos);

  // Aportes consolidados
  const empsComAportes = empreendimentos.filter(e => e.tipo_fluxo === 'com_aportes' || e.tipo_fluxo === 'multi_projetos');
  if (empsComAportes.length > 0) {
    y = drawSectionTitle(doc, y, 'Aportes Consolidados por Semana');
    const aFirstW = 40;
    const aColW = (CW - aFirstW) / (semanas.length + 1);
    const aHeads = ['Empreendimento', ...semanas.map(s => s.rotulo ? s.rotulo.substring(0, 11) : `S${s.numero}`), 'Total'];
    const aWidths = [aFirstW, ...semanas.map(() => aColW), aColW];
    const aRows = [];

    empsComAportes.forEach(emp => {
      const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
      const empLancs = lancamentos.filter(l => l.empreendimento_id === emp.id);
      const projetos = emp.tipo_fluxo === 'multi_projetos' ? (allProjetos || []) : [];
      const despPorSemana = {};
      if (emp.tipo_fluxo === 'multi_projetos') {
        semanas.forEach(s => {
          despPorSemana[s.id] = projetos.reduce((sum, p) => {
            const d = (despesasProjetos || []).find(dd => dd.projeto_id === p.id && dd.semana_id === s.id);
            return sum + (d?.valor_despesa || 0);
          }, 0);
        });
      }
      const empParts = participacoes.filter(p => p.empreendimento_id === emp.id);
      if (!empParts.length) return;

      let saldoAtual = saldoEmp?.saldo_atual || 0;
      if (emp.tipo_fluxo === 'multi_projetos' && projetos.length > 0) {
        saldoAtual = projetos.reduce((sum, p) => sum + (p.saldo_disponivel || 0), 0);
      }
      const cap = calcContasAPagar(empLancs, semanas, emp, despPorSemana);
      const at = calcAporteTotalNecessario(cap, saldoAtual, emp.margem_aporte_total || 0);
      const eq = calcFatorRateio(calcEqualizacao(empParts, at, emp, socios));
      const asAcumulados = calcSaldosAcumulados(empLancs, emp, saldoEmp, semanas, despPorSemana, projetos);
      const as = calcAportesPorSemana(empLancs, emp, saldoEmp, semanas, eq, despPorSemana, projetos, asAcumulados);
      let grand = 0;
      const row = [emp.nome];
      semanas.forEach(s => { const t = as[s.id]?.total || 0; grand += t; row.push(t); });
      row.push(grand);
      aRows.push(row);
    });

    if (aRows.length > 0) {
      const totRow = ['TOTAL GERAL'];
      let g = 0;
      semanas.forEach((_, si) => { const t = aRows.reduce((sum, r) => sum + (typeof r[si + 1] === 'number' ? r[si + 1] : 0), 0); g += t; totRow.push(t); });
      totRow.push(g);
      aRows.push(totRow);
      y = drawTable(doc, y, aHeads, aRows, aWidths, { boldLastRow: true });
    }
  }

  // Páginas por empreendimento
  empreendimentos.forEach(emp => {
    doc.addPage();
    doc.__titulo = `Fluxo de Caixa Semanal — ${emp.nome}`;
    drawHeader(doc, doc.__titulo, subtitulo, geradoEm);

    const saldoEmp = saldos.find(s => s.empreendimento_id === emp.id);
    const projetos = emp.tipo_fluxo === 'multi_projetos' ? (allProjetos || []) : [];
    const d = empData[emp.id] || {};

    drawEmpSection(doc, BODY_TOP, {
      emp, saldoEmp, semanas, lancamentos, projetos,
      despesasProjetos: despesasProjetos || [],
      acumulados: d.acumulados || {},
      contasAPagar: d.contasAPagar || 0,
      aporteNecessario: d.aporteNecessario || 0,
      participacoes, socios, numSemanasContas
    });
  });

  drawFooter(doc, geradoEm);

  const nomeCiclo = cicloAtivo?.nome?.replace(/[\s/]/g, '_') || 'Ciclo';
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Fluxo de Caixa - Geral - ${nomeCiclo}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}