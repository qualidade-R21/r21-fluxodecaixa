import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatBRL } from '@/lib/calculos';

export default function EmpreendimentoCard({ emp, saldoAtual, saldoAcumuladoFinal, contasAPagar, aporteNecessario, temSaldoNegativo, contasAPagarLabel }) {
  const showAporte = emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos';

  return (
    <Link to={`/empreendimento/${emp.id}`}>
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer h-full ${
        temSaldoNegativo ? 'border-2 border-primary' : 'border border-border'
      }`}>
        <CardHeader className="pb-5 p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded flex items-center justify-center shrink-0 ${
                temSaldoNegativo ? 'bg-primary' : 'bg-foreground'
              }`}>
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-[20px] font-heading font-bold leading-tight">{emp.nome}</CardTitle>
                <span className="text-[14px] text-muted-foreground capitalize">{emp.tipo_fluxo.replace('_', ' ')}</span>
              </div>
            </div>
            {temSaldoNegativo && <AlertTriangle className="w-6 h-6 text-primary shrink-0" />}
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-8 pb-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-2">Saldo Atual</p>
              <p className={`text-[18px] font-semibold font-heading tabular-nums leading-tight break-all ${saldoAtual < 0 ? 'text-primary' : ''}`}>
                {formatBRL(saldoAtual)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-2">Saldo Acumulado</p>
              <p className={`text-[18px] font-semibold font-heading tabular-nums leading-tight break-all ${saldoAcumuladoFinal < 0 ? 'text-primary' : ''}`}>
                {formatBRL(saldoAcumuladoFinal)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-2">{contasAPagarLabel || 'Contas à Pagar'}</p>
              <p className="text-[18px] font-semibold font-heading tabular-nums leading-tight break-all">{formatBRL(contasAPagar)}</p>
            </div>
            {showAporte && (
              <div className="min-w-0">
                <p className="text-[12px] uppercase tracking-wider text-[#4A4A4A] font-medium mb-2">Aporte Nec.</p>
                <p className={`text-[18px] font-semibold font-heading tabular-nums leading-tight break-all ${aporteNecessario > 0 ? 'text-primary' : ''}`}>
                  {formatBRL(aporteNecessario)}
                </p>
              </div>
            )}
          </div>
          <div className="mt-5 flex items-center justify-end text-[14px] text-muted-foreground group-hover:text-foreground transition-colors">
            Ver detalhes <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}