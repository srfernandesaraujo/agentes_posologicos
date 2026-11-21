import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgents } from "@/hooks/useAgents";
import { useNewUI } from "@/contexts/NewUIContext";
import { OMNIBAR_CALC_DISCLAIMER, parseOmnibarCalc } from "@/lib/omnibarCalc";
import { useCustomAgents } from "@/hooks/useCustomAgents";
import { useKnowledgeBases } from "@/hooks/useKnowledgeBases";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Bot,
  MessageSquare,
  Database,
  Workflow,
  Video,
  LayoutGrid,
  Store,
  CreditCard,
  User,
  Settings,
  FolderKanban,
  DoorOpen,
  BarChart3,
  Plus,
  Sparkles,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** texto pré-preenchido ao abrir (ex.: sugestão clicada no Início) */
  initialQuery?: string;
}

export function CommandPalette({ open, onOpenChange, initialQuery }: CommandPaletteProps) {
  const { enabled: newUI } = useNewUI();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const { data: agents = [] } = useAgents();
  const { data: customAgents = [] } = useCustomAgents();
  const { data: knowledgeBases = [] } = useKnowledgeBases();

  const { data: conversations = [] } = useQuery({
    queryKey: ["command-palette-conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, agent_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) return [];
      return data || [];
    },
    enabled: !!user && open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["command-palette-projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, color")
        .eq("user_id", user!.id)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data || [];
    },
    enabled: !!user && open,
  });

  useEffect(() => {
    setQuery(open ? initialQuery ?? "" : "");
  }, [open, initialQuery]);

  // Novo visual: frases com números viram cálculo direto na omnibar (determinístico, sem LLM)
  const calc = useMemo(() => (newUI ? parseOmnibarCalc(query) : null), [newUI, query]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const lastConversation = conversations[0];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={newUI ? "Pergunte, calcule ou busque. Ex.: 70 kg 5 mg/kg" : "Buscar agentes, conversas, projetos... ou digite uma ação"}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[480px]">
        {calc && calc.kind === "hint" && (
          <div className="mx-2 mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white/60">{calc.message}</div>
        )}
        {calc && calc.kind !== "hint" && (
          <div className="mx-2 mt-2 rounded-xl border border-[hsl(var(--dom-inicio)/0.4)] bg-[hsl(var(--dom-inicio)/0.08)] p-3.5">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[hsl(var(--dom-inicio))]">
              <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" />{calc.title}</span>
              <button className="normal-case tracking-normal text-white/50 hover:text-white" onClick={() => { onOpenChange(false); navigate("/calculadora"); }}>Abrir calculadora</button>
            </div>
            <div className="mt-2 font-mono text-3xl font-medium text-white">{calc.value} <span className="text-base text-white/50">{calc.unit}</span></div>
            {calc.details.map((d) => <div key={d} className="mt-1 text-xs text-white/70">{d}</div>)}
            <div className="mt-2 font-mono text-[10.5px] leading-snug text-white/40">{calc.formula}</div>
            <div className="mt-1 text-[10.5px] text-white/35">{OMNIBAR_CALC_DISCLAIMER}</div>
          </div>
        )}
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={() => go("/agentes")}>
            <Sparkles className="mr-2 h-4 w-4 text-orange-400" />
            Nova conversa com um agente
          </CommandItem>
          {lastConversation?.agent_id && (
            <CommandItem onSelect={() => go(`/chat/${lastConversation.agent_id}`)}>
              <MessageSquare className="mr-2 h-4 w-4 text-orange-400" />
              Continuar última conversa
            </CommandItem>
          )}
          <CommandItem onSelect={() => go("/meus-agentes")}>
            <Plus className="mr-2 h-4 w-4 text-orange-400" />
            Criar agente personalizado
          </CommandItem>
          <CommandItem onSelect={() => go("/fluxos")}>
            <Workflow className="mr-2 h-4 w-4 text-orange-400" />
            Criar novo fluxo
          </CommandItem>
          <CommandItem onSelect={() => go("/projetos")}>
            <FolderKanban className="mr-2 h-4 w-4 text-orange-400" />
            Abrir projetos
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/dashboard")}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/agentes")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Biblioteca de agentes
          </CommandItem>
          <CommandItem onSelect={() => go("/conversas")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Conversas
          </CommandItem>
          <CommandItem onSelect={() => go("/conteudos")}>
            <Database className="mr-2 h-4 w-4" />
            Bases de conhecimento
          </CommandItem>
          <CommandItem onSelect={() => go("/salas-virtuais")}>
            <DoorOpen className="mr-2 h-4 w-4" />
            Salas virtuais
          </CommandItem>
          <CommandItem onSelect={() => go("/reunioes")}>
            <Video className="mr-2 h-4 w-4" />
            Reuniões
          </CommandItem>
          <CommandItem onSelect={() => go("/marketplace")}>
            <Store className="mr-2 h-4 w-4" />
            Marketplace
          </CommandItem>
          <CommandItem onSelect={() => go("/creditos")}>
            <CreditCard className="mr-2 h-4 w-4" />
            Créditos
          </CommandItem>
          <CommandItem onSelect={() => go("/conta")}>
            <User className="mr-2 h-4 w-4" />
            Minha conta
          </CommandItem>
          <CommandItem onSelect={() => go("/configuracoes")}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </CommandItem>
        </CommandGroup>

        {agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Agentes nativos">
              {agents.map((a) => (
                <CommandItem
                  key={a.id}
                  value={`agente ${a.name} ${a.category}`}
                  onSelect={() => go(`/chat/${a.id}`)}
                >
                  <Bot className="mr-2 h-4 w-4 text-emerald-400" />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-white/40">
                    {a.category}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {customAgents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Meus agentes">
              {customAgents.slice(0, 15).map((a) => (
                <CommandItem
                  key={a.id}
                  value={`meu agente ${a.name}`}
                  onSelect={() => go(`/chat/${a.id}`)}
                >
                  <Bot className="mr-2 h-4 w-4 text-cyan-400" />
                  <span className="flex-1 truncate">{a.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversas recentes">
              {conversations.map((c: any) => (
                <CommandItem
                  key={c.id}
                  value={`conversa ${c.title || ""}`}
                  onSelect={() => go(`/chat/${c.agent_id}?session=${c.id}`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4 text-white/50" />
                  <span className="flex-1 truncate">{c.title || "Conversa sem título"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projetos">
              {projects.map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={`projeto ${p.name}`}
                  onSelect={() => go(`/projetos/${p.id}`)}
                >
                  <FolderKanban
                    className="mr-2 h-4 w-4"
                    style={{ color: p.color || "#f97316" }}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {knowledgeBases.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Bases de conhecimento">
              {knowledgeBases.slice(0, 10).map((kb: any) => (
                <CommandItem
                  key={kb.id}
                  value={`base ${kb.name}`}
                  onSelect={() => go(`/conteudos/${kb.id}`)}
                >
                  <Database className="mr-2 h-4 w-4 text-purple-400" />
                  <span className="flex-1 truncate">{kb.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteProvider() {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInitialQuery(undefined);
        setOpen((o) => !o);
      }
    };
    const openHandler = (e: Event) => {
      setInitialQuery((e as CustomEvent<{ query?: string } | undefined>).detail?.query);
      setOpen(true);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("open-command-palette", openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("open-command-palette", openHandler);
    };
  }, []);

  return <CommandPalette open={open} onOpenChange={setOpen} initialQuery={initialQuery} />;
}