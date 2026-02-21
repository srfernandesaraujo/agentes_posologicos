import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const DEFAULT_COLORS = ["#2D9D78", "#E8A838", "#4A90D9", "#D95B5B", "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899"];

interface ChartData {
  type: "bar" | "pie" | "line" | "area";
  title?: string;
  subtitle?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<Record<string, any>>;
  colors?: string[];
  interpretation?: string;
}

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[hsl(220,25%,12%)] px-3 py-2 shadow-xl">
      {label && <p className="text-xs font-semibold text-white/80 mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs text-white/70">
          <span style={{ color: entry.color }} className="font-medium">{entry.name || entry.dataKey}: </span>
          {typeof entry.value === "number" ? entry.value.toLocaleString("pt-BR") : entry.value}
        </p>
      ))}
    </div>
  );
};

function PieChartComponent({ chart }: { chart: ChartData }) {
  const colors = chart.colors || DEFAULT_COLORS;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chart.data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          labelLine={false}
          label={renderCustomLabel}
          stroke="hsl(220,25%,12%)"
          strokeWidth={2}
        >
          {chart.data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={10}
          wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
          formatter={(value: string) => <span className="text-white/70">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarChartComponent({ chart }: { chart: ChartData }) {
  const colors = chart.colors || DEFAULT_COLORS;
  // Detect grouped bars by checking for "group" field
  const groups = [...new Set(chart.data.map((d) => d.group).filter(Boolean))];
  const isGrouped = groups.length > 1;

  if (isGrouped) {
    // Pivot data for grouped bars
    const categories = [...new Set(chart.data.map((d) => d.name))];
    const pivoted = categories.map((cat) => {
      const row: Record<string, any> = { name: cat };
      groups.forEach((g) => {
        const item = chart.data.find((d) => d.name === cat && d.group === g);
        row[g] = item?.value ?? 0;
      });
      return row;
    });
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={pivoted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} label={chart.yLabel ? { value: chart.yLabel, angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.5)", fontSize: 11 } : undefined} />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" iconSize={10} formatter={(value: string) => <span className="text-white/70">{value}</span>} />
          {groups.map((g, i) => (
            <Bar key={g} dataKey={g} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} label={chart.yLabel ? { value: chart.yLabel, angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.5)", fontSize: 11 } : undefined} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
          {chart.data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartComponent({ chart }: { chart: ChartData }) {
  const colors = chart.colors || DEFAULT_COLORS;
  const groups = [...new Set(chart.data.map((d) => d.group).filter(Boolean))];
  const isGrouped = groups.length > 1;

  if (isGrouped) {
    const categories = [...new Set(chart.data.map((d) => d.name))];
    const pivoted = categories.map((cat) => {
      const row: Record<string, any> = { name: cat };
      groups.forEach((g) => {
        const item = chart.data.find((d) => d.name === cat && d.group === g);
        row[g] = item?.value ?? 0;
      });
      return row;
    });
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={pivoted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" iconSize={10} formatter={(value: string) => <span className="text-white/70">{value}</span>} />
          {groups.map((g, i) => (
            <Line key={g} type="monotone" dataKey={g} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartComponent({ chart }: { chart: ChartData }) {
  const colors = chart.colors || DEFAULT_COLORS;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} fill="url(#areaGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ChartBlock({ jsonString }: { jsonString: string }) {
  let chart: ChartData;
  try {
    chart = JSON.parse(jsonString);
  } catch {
    return <pre className="text-xs text-red-400">Erro ao renderizar gráfico</pre>;
  }

  const ChartMap = {
    pie: PieChartComponent,
    bar: BarChartComponent,
    line: LineChartComponent,
    area: AreaChartComponent,
  };

  const Component = ChartMap[chart.type];
  if (!Component) return <pre className="text-xs text-red-400">Tipo de gráfico não suportado: {chart.type}</pre>;

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {chart.title && (
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: (chart.colors || DEFAULT_COLORS)[0] }} />
          <h4 className="text-sm font-semibold text-white">{chart.title}</h4>
        </div>
      )}
      {chart.subtitle && <p className="mb-3 text-xs text-white/40 ml-[18px]">{chart.subtitle}</p>}
      <Component chart={chart} />
      {chart.interpretation && (
        <p className="mt-3 text-xs text-white/50 italic border-t border-white/5 pt-3">{chart.interpretation}</p>
      )}
    </div>
  );
}
