import { useMemo } from "react";
import { ArrowLeftRight, Home, Building2, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  extractPatientInfo,
  extractReconciliationTable,
  extractReconciliationSummary,
  extractAlerts,
  type PatientInfo,
  type ReconciliationRow,
  type ReconciliationSummary,
} from "@/lib/chatParsers";

function PatientAvatar({ name }: { name?: string }) {
  const initials = (name || "P")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--primary))] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg">
      {initials}
    </div>
  );
}

function PatientCard({ patient }: { patient: PatientInfo }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex gap-4 items-start">
      <PatientAvatar name={patient.name} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white/90 text-sm">{patient.name || "Paciente"}</span>
          {patient.age && <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-0">{patient.age}</Badge>}
        </div>

        {patient.hospitalizationReason && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[hsl(var(--primary))] shrink-0" />
            <span className="text-xs text-white/60">Motivo: <span className="text-white/80">{patient.hospitalizationReason}</span></span>
          </div>
        )}

        {patient.allergies.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-400 font-medium">Alergias:</span>
            {patient.allergies.map((a, i) => (
              <Badge key={i} className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">{a}</Badge>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap text-xs text-white/50">
          {patient.renalFunction && <span>🧪 Renal: <span className="text-white/70">{patient.renalFunction}</span></span>}
          {patient.hepaticFunction && <span>🫁 Hepática: <span className="text-white/70">{patient.hepaticFunction}</span></span>}
        </div>
      </div>
    </div>
  );
}

function getRiskBadge(risk: string) {
  if (/🔴|alto|crítico|high/i.test(risk)) {
    return <Badge className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">🔴 Alto</Badge>;
  }
  if (/🟡|atenção|moderado|médio/i.test(risk)) {
    return <Badge className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">🟡 Atenção</Badge>;
  }
  return <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🟢 OK</Badge>;
}

function getDiscrepancyIcon(discrepancy: string) {
  if (/omissão|omitido|❌/i.test(discrepancy)) return "❌";
  if (/adição|adicionado|➕/i.test(discrepancy)) return "➕";
  if (/dose|📊/i.test(discrepancy)) return "📊";
  if (/substituição|troca|🔄/i.test(discrepancy)) return "🔄";
  if (/frequência|⏱/i.test(discrepancy)) return "⏱️";
  if (/via|🛤/i.test(discrepancy)) return "🛤️";
  return "🔄";
}

function ComparisonTable({ rows }: { rows: ReconciliationRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="bg-[hsl(var(--accent))]/10 px-4 py-2.5 flex items-center gap-2 border-b border-white/10">
        <ArrowLeftRight className="w-4 h-4 text-[hsl(var(--accent))]" />
        <span className="text-sm font-semibold text-white/90">Quadro Comparativo</span>
        <Badge variant="secondary" className="ml-auto text-[10px] bg-white/10 text-white/60 border-0">{rows.length} itens</Badge>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04]">
              <th className="text-left px-3 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Medicamento</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                <span className="flex items-center gap-1"><Home className="w-3 h-3" /> Domiciliar</span>
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Hospitalar</span>
              </th>
              <th className="text-center px-3 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Discrepância</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Risco</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <td className="px-3 py-2.5 font-medium text-white/80">{row.medication}</td>
                <td className="px-3 py-2.5 text-white/60">{row.homeDose || "—"}</td>
                <td className="px-3 py-2.5 text-white/60">{row.hospitalDose || "—"}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="text-sm">{getDiscrepancyIcon(row.discrepancy)}</span>
                </td>
                <td className="px-3 py-2.5 text-center">{getRiskBadge(row.risk)}</td>
                <td className="px-3 py-2.5 text-xs text-white/60">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-white/5">
        {rows.map((row, i) => (
          <div key={i} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white/80 text-sm">{row.medication}</span>
              {getRiskBadge(row.risk)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/[0.04] p-2">
                <span className="text-white/40 flex items-center gap-1 mb-1"><Home className="w-3 h-3" /> Domiciliar</span>
                <span className="text-white/70">{row.homeDose || "—"}</span>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-2">
                <span className="text-white/40 flex items-center gap-1 mb-1"><Building2 className="w-3 h-3" /> Hospitalar</span>
                <span className="text-white/70">{row.hospitalDose || "—"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>{getDiscrepancyIcon(row.discrepancy)} {row.discrepancy}</span>
            </div>
            {row.action && <p className="text-xs text-white/60">{row.action}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryDashboard({ summary }: { summary: ReconciliationSummary }) {
  const items = [
    { label: "Total", value: summary.total, color: "text-white/90", bg: "bg-white/10" },
    { label: "Conciliados", value: summary.reconciled, color: "text-emerald-400", bg: "bg-emerald-500/15" },
    { label: "Atenção", value: summary.attention, color: "text-yellow-400", bg: "bg-yellow-500/15" },
    { label: "Alto Risco", value: summary.highRisk, color: "text-red-400", bg: "bg-red-500/15" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[hsl(var(--accent))]" />
        <span className="text-sm font-semibold text-white/90">Resumo da Conciliação</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className={`rounded-lg ${item.bg} p-3 text-center`}>
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MedicationReconciliationCard({ content }: { content: string }) {
  const patient = useMemo(() => extractPatientInfo(content), [content]);
  const rows = useMemo(() => extractReconciliationTable(content), [content]);
  const summary = useMemo(() => extractReconciliationSummary(content), [content]);
  const alerts = useMemo(() => extractAlerts(content), [content]);

  const hasPatientData = patient.name || patient.age || patient.allergies.length > 0 || patient.hospitalizationReason;

  // Extract high vigilance alerts
  const highVigilanceMatch = content.match(/(?:ALERTAS DE ALTA VIGILÂNCIA|Alta Vigilância)([\s\S]*?)(?:\n#{1,3}\s|⚠️|💡|$)/i);
  const highVigilance: string[] = [];
  if (highVigilanceMatch) {
    const lines = highVigilanceMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*'))) {
        highVigilance.push(trimmed.replace(/^[-•*]\s*/, ''));
      }
    }
  }

  // Extract recommendations
  const recsMatch = content.match(/(?:Recomendações ao Prescritor|RECOMENDAÇÕES)([\s\S]*?)(?:\n═|$)/i);
  const recommendations: string[] = [];
  if (recsMatch) {
    const lines = recsMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*\d+[.)]\s*(.+)/);
      if (m) recommendations.push(m[1].trim());
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--accent))]/20 flex items-center justify-center">
          <ArrowLeftRight className="w-4 h-4 text-[hsl(var(--accent))]" />
        </div>
        <h2 className="text-base font-bold text-white/90">Conciliação Medicamentosa</h2>
      </div>

      {/* Patient */}
      {hasPatientData && <PatientCard patient={patient} />}

      {/* Comparison Table */}
      <ComparisonTable rows={rows} />

      {/* Summary Dashboard */}
      {summary && <SummaryDashboard summary={summary} />}

      {/* High Vigilance Alerts */}
      {highVigilance.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-red-300">Alertas de Alta Vigilância</span>
          </div>
          <ul className="space-y-1 ml-6">
            {highVigilance.map((item, i) => (
              <li key={i} className="text-xs text-red-200/80 leading-relaxed list-disc">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
            <span className="text-sm font-semibold text-white/90">Recomendações ao Prescritor</span>
          </div>
          <ol className="space-y-1.5 ml-1">
            {recommendations.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/70 leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent))] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
