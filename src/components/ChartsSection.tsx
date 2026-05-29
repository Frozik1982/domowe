import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { type StoreData } from '@/hooks/useExpenseStore';

interface Props { data: StoreData }

const MONTHS_SHORT = ['Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru','Sty','Lut','Mar','Kwi'];
const PIE_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#84cc16','#a855f7','#0ea5e9','#64748b'];
const PAID = new Set(['paid-M','paid-J','paid-MJ']);

export default function ChartsSection({ data }: Props) {
  const pieData = useMemo(() =>
    data.categories
      .filter(c => c.amount > 0)
      .map(c => ({ name: c.name, value: c.amount, who: c.assignedTo }))
      .sort((a, b) => b.value - a.value),
    [data.categories]
  );

  const barData = useMemo(() =>
    MONTHS_SHORT.map((month, mi) => {
      let paid = 0, unpaid = 0;
      for (const cat of data.categories) {
        if (!cat.amount) continue;
        const s = data.cells.find(c => c.categoryId === cat.id && c.monthIndex === mi)?.status ?? 'unpaid';
        if (s === 'not-required') continue;
        if (PAID.has(s)) paid += cat.amount;
        else unpaid += cat.amount;
      }
      return { month, paid, unpaid };
    }),
    [data]
  );

  const hasAmounts = pieData.length > 0;
  const total = pieData.reduce((s, d) => s + d.value, 0);

  if (!hasAmounts) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center mt-4">
        <p className="text-2xl mb-2">📊</p>
        <p className="text-sm font-medium text-foreground">Brak danych do wykresu</p>
        <p className="text-xs text-muted-foreground mt-1">Dodaj kwoty miesięczne do kategorii, aby zobaczyć wykresy</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* ── Pie: expense structure ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">📊 Struktura wydatków miesięcznych</h2>
        <p className="text-xs text-muted-foreground mb-4">Łącznie: {total.toLocaleString('pl-PL')} zł/miesiąc</p>
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <div className="w-full sm:w-56 shrink-0" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={0} />)}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [`${val} zł`, '']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5 w-full">
            {pieData.map((item, i) => {
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="flex-1 truncate text-foreground font-medium">{item.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{item.who}</span>
                  <span className="w-14 text-right text-muted-foreground shrink-0">{item.value} zł</span>
                  <div className="w-16 bg-muted rounded-full h-1 shrink-0 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bar: monthly payment progress ── */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-5">
        <h2 className="text-sm font-semibold text-foreground mb-1">📅 Postęp płatności w roku</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Porównanie opłaconych i pozostałych kwot w każdym miesiącu
        </p>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val: number, name: string) => [
                  `${val.toLocaleString('pl-PL')} zł`,
                  name === 'paid' ? 'Opłacone' : 'Pozostałe',
                ]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="paid"   stackId="a" fill="hsl(var(--chart-1))" radius={[0,0,3,3]} />
              <Bar dataKey="unpaid" stackId="a" fill="hsl(var(--muted))"   radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm" style={{background:'hsl(var(--chart-1))'}} /> Opłacone</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm bg-muted" /> Pozostałe</span>
        </div>
      </div>
    </div>
  );
}
