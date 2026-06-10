import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Building2, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatBRL } from '@/lib/calculos';

export default function EmpreendimentoCard({ emp, saldoAtual, saldoAcumuladoFinal, contasAPagar, aporteNecessario, temSaldoNegativo }) {
  const showAporte = emp.tipo_fluxo === 'com_aportes' || emp.tipo_fluxo === 'multi_projetos';

  return (
    <Link to={`/empreendimento/${emp.id}`}>
      <Card className={`group hover:shadow-md transition-all duration-200 cursor-pointer ${
      temSaldoNegativo ? 'border-2 border-primary' : 'border border-border'}`
      }>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded flex items-center justify-center ${
              temSaldoNegativo ? 'bg-primary' : 'bg-foreground'}`
              }>
                <Building2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-heading font-bold">{emp.nome}</CardTitle>
                <span className="text-xs text-muted-foreground capitalize">{emp.tipo_fluxo.replace('_', ' ')}</span>
              </div>
            </div>
            {temSaldoNegativo &&
            <AlertTriangle className="w-4 h-4 text-primary" />
            }
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="uppercase tracking-wider text-muted-foreground font-medium text-sm">SALDO ATUAL</p>
              <p className={`font-bold font-heading text-base ${saldoAtual < 0 ? 'text-primary' : ''}`}>
                {formatBRL(saldoAtual)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wider text-muted-foreground font-medium text-sm">PROJEÇÃO FINAL</p>
              <p className={`text-sm font-bold font-heading ${saldoAcumuladoFinal < 0 ? 'text-primary' : ''}`}>
                {formatBRL(saldoAcumuladoFinal)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wider text-muted-foreground font-medium text-sm">CONTAS A PAGAR</p>
              <p className="text-sm font-bold font-heading">{formatBRL(contasAPagar)}</p>
            </div>
            {showAporte &&
            <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Aporte Nec.</p>
                <p className={`text-sm font-bold font-heading ${aporteNecessario > 0 ? 'text-primary' : ''}`}>
                  {formatBRL(aporteNecessario)}
                </p>
              </div>
            }
          </div>
          <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            Ver detalhes <ArrowRight className="w-3 h-3 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>);

}