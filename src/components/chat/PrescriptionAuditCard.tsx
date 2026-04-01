import { useMemo } from "react";
import { AlertTriangle, Shield, ShieldCheck, ShieldAlert, Pill, User, Heart, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  extractPatientInfo,
  extractMedicationTable,
  extractAlerts,
  extractSafetyScore,
  type PatientInfo,
  type MedicationRow,
  type AlertItem,
} from "@/lib/chatParsers";

function PatientAvatar({ name }: { name?: string }) {
  const initials = (name || "P")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg">
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
          <User className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="font-semibold text-white/90 text-sm">{patient.name || "Paciente"}</span>
          {patient.age && <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-0">{patient.age}</Badge>}
          {patient.weight && <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-0">{patient.weight}</Badge>}
        </div>

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
          {patient.renalFunction && (
            <span>🧪 Renal: <span className="text-white/70">{patient.renalFunction}</span></span>
          )}
          {patient.hepaticFunction && (
            <span>🫁 Hepática: <span className="text-white/70">{patient.hepaticFunction}</span></span>
          )}
        </div>

        {patient.comorbidities.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Heart className="w-3.5 h-3.5 text-[hsl(var(--accent))] shrink-0" />
            {patient.comorbidities.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px] text-white/60 border-white/15">{c}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MedicationTable({ medications }: { medications: MedicationRow[] }) {
  if (medications.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="bg-[hsl(var(--primary))]/10 px-4 py-2.5 flex items-center gap-2 border-b border-white/10">
        <Pill className="w-4 h-4 text-[hsl(var(--primary))]" />
        <span className="text-sm font-semibold text-white/90">Prescrição Analisada</span>
        <Badge variant="secondary" className="ml-auto text-[10px] bg-white/10 text-white/60 border-0">{medications.length} itens</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.04]">
              <th className="text-left px-4 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Medicamento</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Dose</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Via</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-white/50 uppercase tracking-wider">Frequência</th>
            </tr>
          </thead>
          <tbody>
            {medications.map((med, i) => (
              <tr key={i} className={`border-t border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                <td className="px-4 py-2.5 font-medium text-white/80">{med.name}</td>
                <td className="px-4 py-2.5 text-white/60 tabular-nums">{med.dose}</td>
                <td className="px-4 py-2.5 text-white/60">{med.route}</td>
                <td className="px-4 py-2.5 text-white/60">{med.frequency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const config = {
    critical: {
      border: "border-red-500/40",
      bg: "bg-red-500/10",
      icon: <ShieldAlert className="w-5 h-5 text-red-400" />,
      badge: "bg-red-500/20 text-red-300 border-red-500/30",
      label: "CRÍTICO",
    },
    moderate: {
      border: "border-yellow-500/40",
      bg: "bg-yellow-500/10",
      icon: <Shield className="w-5 h-5 text-yellow-400" />,
      badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      label: "MODERADO",
    },
    info: {
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      label: "INFORMATIVO",
    },
  };

  const c = config[alert.level];

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        {c.icon}
        <span className="text-sm font-semibold text-white/90 flex-1">{alert.title}</span>
        <Badge className={`text-[10px] border ${c.badge}`}>{c.label}</Badge>
      </div>
      {alert.details.length > 0 && (
        <ul className="space-y-1 ml-7">
          {alert.details.map((d, i) => (
            <li key={i} className="text-xs text-white/60 leading-relaxed">• {d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SafetyScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  const label = score >= 80 ? "Seguro" : score >= 50 ? "Atenção" : "Alto Risco";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold text-white/90">Score de Segurança</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">{score}%</span>
          <Badge className={`text-[10px] ${score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : score >= 50 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'} border`}>
            {label}
          </Badge>
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function PrescriptionAuditCard({ content }: { content: string }) {
  const patient = useMemo(() => extractPatientInfo(content), [content]);
  const medications = useMemo(() => extractMedicationTable(content), [content]);
  const alerts = useMemo(() => extractAlerts(content), [content]);
  const score = useMemo(() => extractSafetyScore(content), [content]);

  const hasPatientData = patient.name || patient.age || patient.allergies.length > 0 || patient.comorbidities.length > 0;

  // Extract intervention plan (numbered list after "Plano de Intervenção")
  const interventionMatch = content.match(/(?:PLANO DE INTERVENÇÃO|Plano de Intervenção)([\s\S]*?)(?:\n#{1,3}\s|\n\d+\)\s*(?:REFERÊNCIAS|REGRA)|📚|$)/i);
  const interventions: string[] = [];
  if (interventionMatch) {
    const lines = interventionMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*\d+[.)]\s*(.+)/);
      if (m) interventions.push(m[1].trim());
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/20 flex items-center justify-center">
          <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
        </div>
        <h2 className="text-base font-bold text-white/90">Relatório de Auditoria de Prescrição</h2>
      </div>

      {/* Patient Card */}
      {hasPatientData && <PatientCard patient={patient} />}

      {/* Medication Table */}
      <MedicationTable medications={medications} />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white/90">Alertas de Segurança</span>
            <Badge variant="secondary" className="text-[10px] bg-white/10 text-white/60 border-0">{alerts.length}</Badge>
          </div>
          {alerts.map((alert, i) => (
            <AlertCard key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Safety Score */}
      {score !== null && <SafetyScoreBar score={score} />}

      {/* Intervention Plan */}
      {interventions.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-[hsl(var(--accent))]" />
            <span className="text-sm font-semibold text-white/90">Plano de Intervenção</span>
          </div>
          <ol className="space-y-1.5 ml-1">
            {interventions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/70 leading-relaxed">
                <span className="w-5 h-5 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
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
