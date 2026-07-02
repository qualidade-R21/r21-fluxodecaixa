import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { empreendimento_id, ciclo_id, reportPdfBase64, empreendimento_nome, ciclo_nome } = await req.json();

    // Fetch the empreendimento to get its name
    let empNome = empreendimento_nome || 'Empreendimento';
    if (!empreendimento_nome && empreendimento_id) {
      const emp = await base44.asServiceRole.entities.Empreendimento.get(empreendimento_id);
      empNome = emp?.nome || 'Empreendimento';
    }

    // Fetch imported Sienge files for this empreendimento/ciclo
    const registros = await base44.asServiceRole.entities.RegistroImportacao.filter({
      empreendimento_id,
      ciclo_id
    });

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();

    // 1. Add the report PDF (generated on frontend)
    if (reportPdfBase64) {
      const reportBytes = base64ToBytes(reportPdfBase64);
      const reportPdf = await PDFDocument.load(reportBytes, { ignoreEncryption: true });
      const reportPages = await mergedPdf.copyPages(reportPdf, reportPdf.getPageIndices());
      reportPages.forEach(p => mergedPdf.addPage(p));
    }

    const anexos = registros.filter(r => r.file_url);

    // Add each Sienge PDF
    for (const reg of anexos) {
      if (!reg.file_url) continue;
      try {
        const resp = await fetch(reg.file_url);
        if (!resp.ok) continue;
        const pdfBytes = new Uint8Array(await resp.arrayBuffer());
        const siengePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const siengePages = await mergedPdf.copyPages(siengePdf, siengePdf.getPageIndices());
        siengePages.forEach(p => mergedPdf.addPage(p));
      } catch (_e) {
        // Skip files that can't be loaded as PDF
        continue;
      }
    }

    const mergedBytes = await mergedPdf.save();
    const base64 = bytesToBase64(mergedBytes);

    const nomeCiclo = (ciclo_nome || 'Ciclo').replace(/[\s/]/g, '_');
    const fileName = `Fluxo de Caixa - ${empNome} - ${nomeCiclo}.pdf`;

    return Response.json({ pdfBase64: base64, fileName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});