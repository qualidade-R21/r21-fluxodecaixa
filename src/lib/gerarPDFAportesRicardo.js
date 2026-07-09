import jsPDF from 'jspdf';
import { formatBRL } from '@/lib/calculos';

const PW = 297;
const PH = 210;
const ML = 8;
const CW = PW - ML * 2;
const HEADER_H = 18;
const FOOTER_H = 8;
const BODY_TOP = HEADER_H + 4;
const BODY_BOT = PH - FOOTER_H - 2;

const R21_RED = [173, 0, 0];
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

function drawHeader(doc, titulo, subtitulo, geradoEm) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PW, HEADER_H, 'F');

  doc.setFillColor(...R21_RED);
  doc.rect(ML, 2, 16, 14, 'F');
  sf(doc, true, 9);
  doc.setTextColor(...WHITE);
  doc.text('R21', ML + 8, 10.5, { align: 'center' });

  sf(doc, true, 10);
  doc.setTextColor(...WHITE);
  doc.text(titulo, ML + 20, 8.5);

  sf(doc, false, 7);
  doc.setTextColor(200, 200, 200);
  doc.text(subtitulo, ML + 20, 14.5);

  sf(doc, false, 6.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em ${geradoEm}`, PW - ML, 11, { align: 'right' });
}

function drawFooter(doc, geradoEm) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRAY_MED);
    doc.setLineWidth(0.2);
    doc.line(ML, PH - FOOTER_H, PW - ML, PH - FOOTER_H);
    sf(doc, false, 6);
    doc.setTextColor(...GRAY_DARK);
    doc.text('R21 Empreendimentos · Aportes Ricardo', ML, PH - 3);
    doc.text(`${geradoEm}  |  Pág. ${i} / ${total}`, PW - ML, PH - 3, { align: 'right' });
  }
}

function buildSubtitulo(cicloAtivo, semanas) {
  if (!cicloAtivo) return '';
  const s0 = semanas[0];
  const sN = semanas[semanas.length - 1];
  const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const range = s0 && sN ? ` · ${fmt(s0.data_inicio) || s0.rotulo} a ${fmt(sN.data_fim) || sN.rotulo}` : '';
  return `${cicloAtivo.nome}${range}`;
}

export function gerarPDFAportesRicardo({ semanas, rows, getDisplayValue, cicloAtivo }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  const geradoEm = nowStr();
  const subtitulo = buildSubtitulo(cicloAtivo, semanas);

  drawHeader(doc, 'Aportes Ricardo — Consolidação Semanal', subtitulo, geradoEm);
  let y = BODY_TOP;

  // Tabela
  const firstW = 50;
  const colW = (CW - firstW) / (semanas.length + 1);
  const widths = [firstW, ...semanas.map(() => colW), colW];
  const heads = ['Origem', ...semanas.map(s => s.rotulo ? s.rotulo.substring(0, 13) : `S${s.numero}`), 'Total'];

  const HEAD_H = 7;
  const ROW_H = 7;

  // Header
  doc.setFillColor(...BLACK);
  doc.rect(ML, y, CW, HEAD_H, 'F');
  sf(doc, true, 6.5);
  doc.setTextColor(...WHITE);
  let cx = ML;
  heads.forEach((h, i) => {
    const align = i === 0 ? 'left' : 'right';
    const tx = align === 'left' ? cx + 1.5 : cx + widths[i] - 1.5;
    doc.text(String(h), tx, y + 4.8, { align });
    cx += widths[i];
  });
  y += HEAD_H;

  // Body rows
  rows.forEach((row, ri) => {
    let total = 0;
    const isLast = ri === rows.length - 1;

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
      const tx = align === 'left' ? cx + 1.5 : cx + widths[ci] - 1.5;

      let display, color = BLACK;
      if (cell === null || cell === undefined) {
        display = '—';
      } else if (typeof cell === 'number') {
        display = formatBRL(cell);
        color = cell < 0 ? R21_RED : (cell > 0 ? [22, 163, 74] : BLACK);
      } else {
        display = String(cell);
      }

      doc.setTextColor(...color);
      doc.text(display, tx, y + 4.3, { align });
      cx += widths[ci];
    });

    y += ROW_H;
  });

  // Total row
  {
    const totalRow = ['TOTAL'];
    let grand = 0;
    semanas.forEach(s => {
      const t = rows.reduce((sum, r) => sum + getDisplayValue(r, s.id), 0);
      grand += t;
      totalRow.push(t);
    });
    totalRow.push(grand);

    doc.setFillColor(...BLACK);
    doc.rect(ML, y, CW, ROW_H, 'F');
    sf(doc, true, 6.5);
    let cx = ML;
    totalRow.forEach((cell, ci) => {
      const align = ci === 0 ? 'left' : 'right';
      const tx = align === 'left' ? cx + 1.5 : cx + widths[ci] - 1.5;
      let display, color = WHITE;
      if (typeof cell === 'number') {
        display = formatBRL(cell);
      } else {
        display = String(cell);
      }
      doc.setTextColor(...color);
      doc.text(display, tx, y + 4.3, { align });
      cx += widths[ci];
    });
    y += ROW_H + 4;
  }

  drawFooter(doc, geradoEm);

  const nomeCiclo = cicloAtivo?.nome?.replace(/[\s/]/g, '_') || 'Ciclo';
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Aportes Ricardo - ${nomeCiclo}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}