import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatBRL } from '@/lib/calculos';

export default function EmpreendimentoCard({ emp, saldoAtual, saldoAcumuladoFinal, contasAPagar, aporteNecessario, temSaldoNegativo }) {
  const showAporte = emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos';

  return (
    <Link to={`/empreendimento/${emp.id}`}>
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer h-full ${
        temSaldoNegativo ? 'border-2 border-primary' : 'border border-border'
      }`}>
        <CardHeader className="pb-4 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                temSaldoNegativo ? 'bg-primary' : 'bg-foreground'
              }`}>
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-[16px] font-heading font-bold leading-tight">{emp.nome}</CardTitle>
                <span className="text-[13px] text-muted-foreground capitalize">{emp.tipo_fluxo.replace('_', ' ')}</span>
              </div>
            </div>
            {temSaldoNegativo && <AlertTriangle className="w-5 h-5 text-primary shrink-0" />}
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-6 pb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Saldo Atual</p>
              <p className={`text-[20px] font-medium font-heading tabular-nums leading-tight ${saldoAtual < 0 ? 'text-primary' : ''}`}>
                {formatBRL(saldoAtual)}
              </p>
            </div>
            <div>
              <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Projeção Final</p>
              <p className={`text-[20px] font-medium font-heading tabular-nums leading-tight ${saldoAcumuladoFinal < 0 ? 'text-primary' : ''}`}>
                {formatBRL(saldoAcumuladoFinal)}
              </p>
            </div>
            <div>
              <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Contas a Pagar</p>
              <p className="text-[20px] font-medium font-heading tabular-nums leading-tight">{formatBRL(contasAPagar)}</p>
            </div>
            {showAporte && (
              <div>
                <p className="text-[13px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-1">Aporte Nec.</p>
                <p className={`text-[20px] font-medium font-heading tabular-nums leading-tight ${aporteNecessario > 0 ? 'text-primary' : ''}`}>
                  {formatBRL(aporteNecessario)}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-end text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
            Ver detalhes <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}