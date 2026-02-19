import { useNavigate } from "react-router-dom";
import { Agent, CATEGORY_COLORS } from "@/hooks/useAgents";
import { getIcon } from "@/lib/icons";
import { Coins, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate();
  const Icon = getIcon(agent.icon);
  const catColor = CATEGORY_COLORS[agent.category] || "bg-primary";

  return (
    <div className="group glass-card rounded-xl p-6 transition-all hover:shadow-xl hover:-translate-y-1 animate-fade-in">
      <div className="mb-4 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${catColor} text-primary-foreground`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <Coins className="h-3 w-3" />
          {agent.credit_cost}
        </div>
      </div>

      <h3 className="mb-2 font-display text-lg font-semibold leading-tight">{agent.name}</h3>
      <p className="mb-5 text-sm text-muted-foreground line-clamp-3">{agent.description}</p>

      <Button
        onClick={() => navigate(`/chat/${agent.id}`)}
        className="w-full gap-2"
        variant="outline"
      >
        Iniciar Chat
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  );
}
