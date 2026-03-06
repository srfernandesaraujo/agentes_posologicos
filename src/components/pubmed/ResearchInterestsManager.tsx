import { useState } from "react";
import { useResearchInterests } from "@/hooks/useResearchInterests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookOpen, Bell } from "lucide-react";
import { toast } from "sonner";

export function ResearchInterestsManager() {
  const { data: interests = [], addInterest, toggleInterest, deleteInterest } = useResearchInterests();
  const [newTerm, setNewTerm] = useState("");

  const handleAdd = async () => {
    if (!newTerm.trim()) return;
    try {
      await addInterest.mutateAsync(newTerm);
      setNewTerm("");
      toast.success("Interesse adicionado! Você receberá notificações semanais.");
    } catch {
      toast.error("Erro ao adicionar interesse.");
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleInterest.mutateAsync({ id, is_active: !current });
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInterest.mutateAsync(id);
      toast.success("Interesse removido.");
    } catch {
      toast.error("Erro ao remover.");
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Monitor PubMed Semanal</CardTitle>
        </div>
        <CardDescription>
          Cadastre seus interesses de pesquisa e receba notificações automáticas quando novos artigos forem publicados no PubMed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder='Ex: "metformina longevidade", "resistência antimicrobiana"'
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={addInterest.isPending || !newTerm.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {interests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum interesse cadastrado. Adicione termos de pesquisa acima.
          </p>
        ) : (
          <div className="space-y-2">
            {interests.map((interest) => (
              <div
                key={interest.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3 bg-card"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{interest.terms}</span>
                  <Badge variant={interest.is_active ? "default" : "secondary"} className="shrink-0 text-xs">
                    {interest.is_active ? "Ativo" : "Pausado"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={interest.is_active}
                    onCheckedChange={() => handleToggle(interest.id, interest.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(interest.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
