/**
 * Detects if content is a Prescription Audit report
 */
export function isPrescriptionAudit(content: string): boolean {
  return (
    content.includes("RELATÓRIO DE AUDITORIA DE PRESCRIÇÃO") ||
    content.includes("RESUMO DA PRESCRIÇÃO ANALISADA")
  );
}

/**
 * Detects if content is a Medication Reconciliation report
 */
export function isMedicationReconciliation(content: string): boolean {
  return (
    (content.includes("Conciliação Medicamentosa") || content.includes("CONCILIAÇÃO MEDICAMENTOSA") || content.includes("Conciliador Medicamentoso")) &&
    (content.includes("Uso Domiciliar") || content.includes("Prescrição Atual") || content.includes("Discrepância"))
  );
}

export interface PatientInfo {
  name?: string;
  age?: string;
  weight?: string;
  allergies: string[];
  renalFunction?: string;
  hepaticFunction?: string;
  comorbidities: string[];
  hospitalizationReason?: string;
}

export interface MedicationRow {
  name: string;
  dose: string;
  route: string;
  frequency: string;
}

export interface AlertItem {
  level: "critical" | "moderate" | "info";
  title: string;
  details: string[];
}

export interface ReconciliationRow {
  number: string;
  medication: string;
  homeDose: string;
  hospitalDose: string;
  discrepancy: string;
  risk: string;
  action: string;
}

export interface ReconciliationSummary {
  total: number;
  reconciled: number;
  attention: number;
  highRisk: number;
}

/**
 * Extract patient info from text, looking for common patterns
 */
export function extractPatientInfo(content: string): PatientInfo {
  const info: PatientInfo = { allergies: [], comorbidities: [] };

  // Name patterns
  const nameMatch = content.match(/(?:Paciente|Nome)[:\s]*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/);
  if (nameMatch) info.name = nameMatch[1].trim();

  // Age
  const ageMatch = content.match(/(\d{1,3})\s*(?:anos|a\.?\s)/i);
  if (ageMatch) info.age = ageMatch[1] + " anos";

  // Weight
  const weightMatch = content.match(/(\d{2,3}(?:[.,]\d)?)\s*kg/i);
  if (weightMatch) info.weight = weightMatch[1] + " kg";

  // Allergies
  const allergyMatch = content.match(/[Aa]lergia[s]?[:\s]*([^\n.]+)/);
  if (allergyMatch) {
    const raw = allergyMatch[1].trim();
    if (!/n[ãa]o|negad|nega|sem|ausente/i.test(raw)) {
      info.allergies = raw.split(/[,;e]/).map(a => a.trim()).filter(Boolean);
    }
  }

  // Renal function
  const renalMatch = content.match(/(?:ClCr|clearance|TFG|função renal)[:\s]*([^\n|]+)/i);
  if (renalMatch) info.renalFunction = renalMatch[1].trim();

  // Hepatic function
  const hepaticMatch = content.match(/(?:função hepática|hepat)[:\s]*([^\n|]+)/i);
  if (hepaticMatch) info.hepaticFunction = hepaticMatch[1].trim();

  // Comorbidities
  const comorbMatch = content.match(/[Cc]omorbidades?[:\s]*([^\n]+)/);
  if (comorbMatch) {
    info.comorbidities = comorbMatch[1].split(/[,;]/).map(c => c.trim()).filter(Boolean);
  }

  // Hospitalization reason
  const hospMatch = content.match(/(?:motivo da internação|internado por|admitido por)[:\s]*([^\n]+)/i);
  if (hospMatch) info.hospitalizationReason = hospMatch[1].trim();

  return info;
}

/**
 * Extract medication table rows from markdown tables
 */
export function extractMedicationTable(content: string): MedicationRow[] {
  const rows: MedicationRow[] = [];
  // Match table rows (skip headers and separators)
  const tableRegex = /\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/g;
  let match;
  let skipNext = 2; // skip header and separator
  
  // Find the prescription table section
  const prescSection = content.match(/(?:RESUMO DA PRESCRIÇÃO|Prescrição Analisada|Medicamento\s*\|)([\s\S]*?)(?:\n\n|\n#{1,3}\s|\n\d+\)|$)/i);
  if (!prescSection) return rows;
  
  const section = prescSection[0];
  const lines = section.split('\n');
  
  for (const line of lines) {
    if (!line.includes('|') || /^[\s|:-]+$/.test(line.replace(/\|/g, '').replace(/-/g, ''))) continue;
    if (/Medicamento|medicamento|Coluna/i.test(line) && /Dose|dose/i.test(line)) continue;
    
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 3) {
      // Remove row numbers if present
      const startIdx = /^\d+$/.test(cells[0]) ? 1 : 0;
      rows.push({
        name: cells[startIdx] || '',
        dose: cells[startIdx + 1] || '',
        route: cells[startIdx + 2] || '',
        frequency: cells[startIdx + 3] || cells[startIdx + 2] || '',
      });
    }
  }
  return rows;
}

/**
 * Extract alerts from the audit report
 */
export function extractAlerts(content: string): AlertItem[] {
  const alerts: AlertItem[] = [];
  
  // Split by alert markers
  const sections = content.split(/(?=🔴|🟡|🟢)/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    let level: AlertItem['level'] | null = null;
    if (section.startsWith('🔴')) level = 'critical';
    else if (section.startsWith('🟡')) level = 'moderate';
    else if (section.startsWith('🟢')) level = 'info';
    
    if (!level) continue;
    
    const lines = section.split('\n').filter(l => l.trim());
    const title = lines[0]?.replace(/^[🔴🟡🟢]\s*/, '').trim() || '';
    const details = lines.slice(1)
      .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
      .map(l => l.trim().replace(/^[-•]\s*/, ''));
    
    // If no bullet details, grab remaining lines
    if (details.length === 0) {
      details.push(...lines.slice(1).map(l => l.trim()).filter(Boolean));
    }
    
    if (title) {
      alerts.push({ level, title, details });
    }
  }
  
  return alerts;
}

/**
 * Extract safety score if present
 */
export function extractSafetyScore(content: string): number | null {
  const match = content.match(/(?:Score|Pontuação|Segurança)[:\s]*(\d{1,3})\s*(?:\/\s*100|%)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Extract reconciliation table rows
 */
export function extractReconciliationTable(content: string): ReconciliationRow[] {
  const rows: ReconciliationRow[] = [];
  
  // Find the comparison table
  const tableSection = content.match(/(?:Quadro Comparativo|Conciliação)([\s\S]*?)(?:\n\n#{1,3}\s|\n📊|\n##)/i);
  if (!tableSection) return rows;
  
  const lines = tableSection[0].split('\n');
  
  for (const line of lines) {
    if (!line.includes('|') || /^[\s|:-]+$/.test(line.replace(/\|/g, '').replace(/-/g, ''))) continue;
    if (/Medicamento|#|medicamento/i.test(line) && /Discrepância|discrepância|Risco/i.test(line)) continue;
    
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 5) {
      const startIdx = /^\d+$/.test(cells[0]) ? 0 : -1;
      rows.push({
        number: cells[startIdx + 1] || '',
        medication: cells[startIdx + 2] || '',
        homeDose: cells[startIdx + 3] || '',
        hospitalDose: cells[startIdx + 4] || '',
        discrepancy: cells[startIdx + 5] || '',
        risk: cells[startIdx + 6] || '',
        action: cells[startIdx + 7] || '',
      });
    }
  }
  return rows;
}

/**
 * Extract reconciliation summary counts
 */
export function extractReconciliationSummary(content: string): ReconciliationSummary | null {
  const summary: ReconciliationSummary = { total: 0, reconciled: 0, attention: 0, highRisk: 0 };
  
  const totalMatch = content.match(/Total[^|]*\|\s*(\d+)/i);
  const reconciledMatch = content.match(/conciliados?[^|]*\|\s*(\d+)/i);
  const attentionMatch = content.match(/atenção[^|]*\|\s*(\d+)/i);
  const highRiskMatch = content.match(/(?:alto risco|🔴)[^|]*\|\s*(\d+)/i);
  
  if (totalMatch) summary.total = parseInt(totalMatch[1]);
  if (reconciledMatch) summary.reconciled = parseInt(reconciledMatch[1]);
  if (attentionMatch) summary.attention = parseInt(attentionMatch[1]);
  if (highRiskMatch) summary.highRisk = parseInt(highRiskMatch[1]);
  
  if (summary.total > 0 || summary.reconciled > 0) return summary;
  return null;
}
