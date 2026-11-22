import { useMemo } from "react";

interface Props {
  /** datas ISO de cada atividade */
  dates: string[];
  weeks?: number;
  /** cor, ex.: "var(--dom-clinica)" (sem hsl) */
  tone?: string;
  /** texto do tooltip: recebe a data e a contagem */
  describe?: (d: Date, n: number) => string;
}

const DAY = 86_400_000;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Mapa de atividade em semanas (colunas) por dia da semana (linhas). Mais intenso = mais atividade. */
export function ActivityHeatmap({ dates, weeks = 18, tone = "var(--dom-clinica)", describe }: Props) {
  const { cells, max } = useMemo(() => {
    const today = startOfDay(new Date());
    // a última coluna termina no sábado da semana atual
    const end = new Date(today.getTime() + (6 - today.getDay()) * DAY);
    const start = new Date(end.getTime() - (weeks * 7 - 1) * DAY);
    const counts = new Map<number, number>();
    dates.forEach((iso) => {
      const t = startOfDay(new Date(iso)).getTime();
      if (t >= start.getTime() && t <= end.getTime()) counts.set(t, (counts.get(t) || 0) + 1);
    });
    const list: { date: Date; n: number; future: boolean; col: number; row: number }[] = [];
    let m = 0;
    for (let i = 0; i < weeks * 7; i++) {
      const date = new Date(start.getTime() + i * DAY);
      const n = counts.get(date.getTime()) || 0;
      m = Math.max(m, n);
      list.push({ date, n, future: date.getTime() > today.getTime(), col: Math.floor(i / 7), row: i % 7 });
    }
    return { cells: list, max: m };
  }, [dates, weeks]);

  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / Math.max(max, 1)) * 4)));
  const alpha = [0.06, 0.28, 0.5, 0.75, 1];
  const label = describe ?? ((d, n) => `${d.toLocaleDateString("pt-BR")}: ${n} ${n === 1 ? "atividade" : "atividades"}`);

  return (
    <div className="overflow-x-auto" role="img" aria-label={`Mapa de atividade das últimas ${weeks} semanas`}>
      <div className="grid w-max grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)" }}>
        {cells.map((c) => (
          <i
            key={c.date.getTime()}
            title={c.future ? undefined : label(c.date, c.n)}
            className="pos-pop block h-3 w-3 rounded-[3px]"
            style={{
              background: c.future ? "transparent" : `hsl(${tone} / ${alpha[level(c.n)]})`,
              border: c.future ? "1px dashed hsl(var(--border))" : undefined,
              animationDelay: `${c.col * 28 + c.row * 6}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
