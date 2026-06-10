import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { formatBRL } from '@/lib/calculos';

const COLORS = ['#AD0000', '#000000', '#4A4A4A', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2'];

export default function SaldoChart({ empreendimentos, semanas, acumuladosPorEmp }) {
  if (!semanas || semanas.length === 0) return null;

  const chartData = semanas.map(s => {
    const row = { name: s.rotulo || `Sem ${s.numero}` };
    empreendimentos.forEach((emp, idx) => {
      row[emp.nome] = acumuladosPorEmp[emp.id]?.[s.id] || 0;
    });
    return row;
  });

  const customTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-card border border-border rounded p-3 shadow-lg">
        <p className="font-heading font-bold text-xs mb-2">{label}</p>
        {payload.map((entry, idx) => (
          <p key={idx} className="text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className={`font-bold ${entry.value < 0 ? 'text-primary' : ''}`}>{formatBRL(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading">Saldo Acumulado por Semana</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Ubuntu' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'Ubuntu' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              <ReferenceLine y={0} stroke="#AD0000" strokeDasharray="4 4" />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Ubuntu' }} />
              {empreendimentos.map((emp, idx) => (
                <Line
                  key={emp.id}
                  type="monotone"
                  dataKey={emp.nome}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}