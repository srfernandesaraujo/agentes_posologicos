import {
  Activity, Bot, Building2, BookOpen, Calculator, CreditCard, Database, DoorOpen, FolderKanban,
  GraduationCap, Home, Layers, LifeBuoy, Mail, MessageSquare, Settings, Shield, Stethoscope, Store,
  User, Users, Video, Workflow, type LucideIcon,
} from "lucide-react";

export type DomainId = "inicio" | "clinica" | "equipes" | "ensino" | "acervo" | "ajuda";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** prefixos de rota extras que também ativam este item */
  match?: string[];
  /** chave de contagem exibida ao lado (preenchida por useNavCounts) */
  countKey?: "agents" | "conversations" | "knowledge" | "tickets" | "awaiting";
  dataTour?: string;
  adminOnly?: boolean;
}

export interface Domain {
  id: DomainId;
  label: string;
  /** nome da cor em tailwind/CSS: usa var(--dom-<id>) */
  icon: LucideIcon;
  tagline: string;
  items: NavItem[];
}

export const DOMAINS: Domain[] = [
  {
    id: "inicio", label: "Início", icon: Home, tagline: "O que precisa de você agora",
    items: [{ to: "/dashboard", label: "Central de comando", icon: Home }],
  },
  {
    id: "clinica", label: "Clínica", icon: Activity, tagline: "Calcule, consulte e converse",
    items: [
      { to: "/calculadora", label: "Calculadora de dose", icon: Calculator },
      { to: "/agentes", label: "Agentes", icon: Bot, match: ["/chat"] },
      { to: "/meus-agentes", label: "Meus agentes", icon: Bot, countKey: "agents", dataTour: "my-agents" },
      { to: "/conversas", label: "Conversas", icon: MessageSquare, countKey: "conversations" },
    ],
  },
  {
    id: "equipes", label: "Equipes", icon: Users, tagline: "Agentes trabalhando juntos",
    items: [
      { to: "/squads", label: "Squads", icon: Users, countKey: "awaiting" },
      { to: "/reunioes", label: "Reuniões", icon: Video, match: ["/reuniao-viva"] },
      { to: "/fluxos", label: "Fluxos", icon: Workflow, match: ["/orquestrador"] },
    ],
  },
  {
    id: "ensino", label: "Ensino", icon: GraduationCap, tagline: "Ensinar e avaliar",
    items: [
      { to: "/salas-virtuais", label: "Salas virtuais", icon: DoorOpen },
      { to: "/osce", label: "OSCE", icon: Stethoscope },
    ],
  },
  {
    id: "acervo", label: "Acervo", icon: Layers, tagline: "Guardar, organizar e descobrir",
    items: [
      { to: "/conteudos", label: "Conteúdos", icon: Database, countKey: "knowledge" },
      { to: "/projetos", label: "Projetos", icon: FolderKanban },
      { to: "/marketplace", label: "Marketplace", icon: Store },
    ],
  },
  {
    id: "ajuda", label: "Conta e ajuda", icon: User, tagline: "Conta, créditos e suporte",
    items: [
      { to: "/creditos", label: "Créditos", icon: CreditCard },
      { to: "/conta", label: "Conta", icon: User },
      { to: "/instituicao", label: "Instituição", icon: Building2 },
      { to: "/suporte", label: "Suporte", icon: LifeBuoy, countKey: "tickets" },
      { to: "/contato", label: "Contato", icon: Mail },
      { to: "/documentacao", label: "Documentação", icon: BookOpen },
      { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
      { to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
    ],
  },
];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/** Descobre domínio e item ativos para a rota atual (o prefixo mais longo vence). */
export function resolveRoute(pathname: string): { domain: Domain; item: NavItem | null } {
  let best: { domain: Domain; item: NavItem; len: number } | null = null;
  for (const domain of DOMAINS) {
    for (const item of domain.items) {
      for (const p of [item.to, ...(item.match ?? [])]) {
        if (matches(pathname, p) && (!best || p.length > best.len)) best = { domain, item, len: p.length };
      }
    }
  }
  if (best) return { domain: best.domain, item: best.item };
  return { domain: DOMAINS[1], item: null };
}
