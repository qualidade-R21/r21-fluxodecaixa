import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const passos = [
  'Arquive a versão da semana (botão acima) antes de alterar dados.',
  'Atualize os saldos bancários de cada empreendimento.',
  'Importe os relatórios Sienge nesta ordem: Grupo Green Concept → RIC → Cape Town, Holmes, Solenne, Pátio Estaleiro, Ponta do Lobo → GTR.',
  'Faça os ajustes manuais e registre o motivo nas Observações.',
  'Confira o Dashboard e a página Aportes Ricardo e gere os PDFs.',
];

export default function ComoAtualizarPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#E5E5E5] rounded-lg bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 font-heading"
      >
        <span className="text-[15px] font-medium text-[#AD0000]">
          Como atualizar o fluxo desta semana
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#AD0000]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#AD0000]" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-[14px] text-foreground">
            {passos.map((passo, i) => (
              <li key={i} className="leading-relaxed">{passo}</li>
            ))}
          </ol>

          <div className="flex items-start gap-3 bg-[#F3F3F3] rounded-lg px-4 py-3 text-[13px] text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Os valores se atualizam automaticamente a cada lançamento. Esta ordem serve para você acompanhar números finais durante o processo — se precisar fugir dela, o resultado final continua correto.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}