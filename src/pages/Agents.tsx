import { useState } from "react";
import { useAgents, CATEGORIES } from "@/hooks/useAgents";
import { AgentCard } from "@/components/agents/AgentCard";
import { Bot, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const filtered = agents.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCat || a.category === selectedCat;
    return matchesSearch && matchesCat;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 animate-slide-up">
        <h1 className="mb-2 font-display text-3xl font-bold">Agentes de IA</h1>
        <p className="text-muted-foreground">
          Escolha um agente especializado para começar
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCat(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !selectedCat
              ? "gradient-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          Todos
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCat === cat
                ? "gradient-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bot className="mb-4 h-12 w-12" />
          <p>Nenhum agente encontrado</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
