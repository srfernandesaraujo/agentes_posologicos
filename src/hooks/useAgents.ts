import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  credit_cost: number;
  active: boolean;
}

export const CATEGORIES = [
  "Prática Clínica e Farmácia",
  "EdTech e Professores 4.0",
  "Pesquisa Acadêmica e Dados",
  "Produção de Conteúdo e Nicho Tech",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  "Prática Clínica e Farmácia": "bg-cat-clinica",
  "EdTech e Professores 4.0": "bg-cat-edtech",
  "Pesquisa Acadêmica e Dados": "bg-cat-pesquisa",
  "Produção de Conteúdo e Nicho Tech": "bg-cat-conteudo",
};

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("active", true)
        .order("category");
      if (error) throw error;
      return data as Agent[];
    },
  });
}
