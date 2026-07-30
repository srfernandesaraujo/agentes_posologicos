import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Loader2 } from "lucide-react";

interface Props {
  institutionId: string;
}

export function StudentTurmas({ institutionId }: Props) {
  const { user } = useAuth();

  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ["student-turmas", institutionId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from("turma_enrollments")
        .select("turma_id, turmas(name)")
        .eq("student_id", user!.id);
      if (error) throw error;
      return (enrollments || [])
        .filter((e: any) => e.turmas)
        .map((e: any) => ({ id: e.turma_id, name: e.turmas.name as string }));
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Minhas turmas</CardTitle>
        </div>
        <CardDescription>Turmas em que você está matriculado(a).</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : turmas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não está matriculado em nenhuma turma.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {turmas.map((t) => (
              <Badge key={t.id} variant="outline">{t.name}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
