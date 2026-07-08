import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { formatBRL } from '@/lib/calculos';

const COLORS = ['#AD0000', '#000000', '#4A4A4A', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2'];

export default function SaldoChart({ empreendimentos, semanas, acumuladosPorEmp, modoOculto }) {
  if (!semanas || semanas.length === 0) return null;

  const ultimaSemana = semanas[semanas.length - 1];

  const chartData = empreendimentos
    .map(emp => ({
      name: modoOculto ? '••••••' : emp.nome,
      value: acumuladosPorEmp[emp.id]?.[ultimaSemana.id] || 0,
    }))
    .sort((a, b) => b.value - a.value);

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    return (
      <div className="bg-card border border-border rounded p-3 shadow-lg">
        <p className="font-heading font-bold text-[14px] mb-1">{label}</p>
        <p className={`text-[14px] font-semibold ${!modoOculto && val < 0 ? 'text-primary' : ''}`}>
          {modoOculto ? '••••••' : formatBRL(val)}
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3 px-6 pt-6">
        <CardTitle className="text-[20px] font-heading font-medium">
          Saldo Acumulado — {ultimaSemana.rotulo || `Sem ${ultimaSemana.numero}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 16, left: 16, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 13, fontFamily: 'Ubuntu' }}
                tickFormatter={v => modoOculto ? '••' : `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 13, fontFamily: 'Ubuntu' }}
                width={150}
              />
              <Tooltip content={customTooltip} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={entry.value < 0 ? 0.85 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}