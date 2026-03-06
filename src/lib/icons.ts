import {
  HeartPulse,
  BookOpen,
  Pill,
  GraduationCap,
  Stethoscope,
  BarChart3,
  FileText,
  Calculator,
  Youtube,
  ShieldCheck,
  Bot,
  ScanEye,
  FileSearch,
  UserRound,
  ClipboardList,
  ShieldAlert,
  GitCompare,
  LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  HeartPulse,
  BookOpen,
  Pill,
  GraduationCap,
  Stethoscope,
  BarChart3,
  FileText,
  Calculator,
  Youtube,
  ShieldCheck,
  Bot,
  ScanEye,
  FileSearch,
  UserRound,
  ClipboardList,
  ShieldAlert,
  GitCompare,
};

export function getIcon(name: string): LucideIcon {
  return iconMap[name] || Bot;
}
