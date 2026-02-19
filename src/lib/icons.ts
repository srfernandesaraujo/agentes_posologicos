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
};

export function getIcon(name: string): LucideIcon {
  return iconMap[name] || Bot;
}
